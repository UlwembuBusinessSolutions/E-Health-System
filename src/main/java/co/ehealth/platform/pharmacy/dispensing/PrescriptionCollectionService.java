package co.ehealth.platform.pharmacy.dispensing;

import co.ehealth.platform.core.audit.AuditDetails;
import co.ehealth.platform.core.audit.AuditLogService;
import co.ehealth.platform.core.notification.WhatsAppMessageTemplate;
import co.ehealth.platform.core.notification.WhatsAppNotificationDispatcher;
import co.ehealth.platform.facility.Facility;
import co.ehealth.platform.facility.FacilityRepository;
import co.ehealth.platform.patient.Patient;
import co.ehealth.platform.patient.PatientRepository;
import co.ehealth.platform.pharmacy.Prescription;
import co.ehealth.platform.pharmacy.PrescriptionItem;
import co.ehealth.platform.pharmacy.PrescriptionItemNotFoundException;
import co.ehealth.platform.pharmacy.PrescriptionItemRepository;
import co.ehealth.platform.pharmacy.PrescriptionStatus;
import co.ehealth.platform.pharmacy.dispensing.DispenseAllocationService.DispenseOutcome;
import co.ehealth.platform.pharmacy.dispensing.DispenseAllocationService.DispenseRequest;
import org.springframework.stereotype.Service;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

// The pharmacy counter hand-over: gives the patient (or an authorised
// collector) every item that is in stock, in one atomic action.
//
// Items without usable stock are reported as skipped, never failed and never
// silently part-filled (STK-12): the pharmacist sees exactly what was and was
// not handed over. If anything unexpected goes wrong part-way (for example
// another pharmacist takes the last unit between the check and the
// deduction) the whole hand-over rolls back.
@Service
public class PrescriptionCollectionService {

    private final DispensingGuard guard;
    private final PrescriptionItemRepository itemRepository;
    private final DispenseAllocationService allocationService;
    private final CollectionRules collectionRules;
    private final SubstitutionLookup substitutionLookup;
    private final ProductScheduleLookup scheduleLookup;
    private final PrescriptionCollectionRepository collectionRepository;
    private final PrescriptionRollup rollup;
    private final AuditLogService auditLogService;
    private final Clock clock;
    @Autowired
    private PatientRepository patients;
    @Autowired
    private FacilityRepository facilities;
    @Autowired
    private WhatsAppNotificationDispatcher whatsAppNotifications;

    public PrescriptionCollectionService(DispensingGuard guard, PrescriptionItemRepository itemRepository,
                                          DispenseAllocationService allocationService,
                                          CollectionRules collectionRules, SubstitutionLookup substitutionLookup,
                                          ProductScheduleLookup scheduleLookup,
                                          PrescriptionCollectionRepository collectionRepository,
                                          PrescriptionRollup rollup, AuditLogService auditLogService, Clock clock) {
        this.guard = guard;
        this.itemRepository = itemRepository;
        this.allocationService = allocationService;
        this.collectionRules = collectionRules;
        this.substitutionLookup = substitutionLookup;
        this.scheduleLookup = scheduleLookup;
        this.collectionRepository = collectionRepository;
        this.rollup = rollup;
        this.auditLogService = auditLogService;
        this.clock = clock;
    }

    public record HandedOverItem(UUID itemId, String drugName, int quantity, List<LotDraw> lots) {
    }

    public record SkippedItem(UUID itemId, String drugName, SkipReason reason) {
    }

    // collectionId is null when nothing could be handed over (no collection
    // event happened, so none is recorded).
    public record CollectOutcome(UUID collectionId, List<HandedOverItem> handedOver, List<SkippedItem> skipped) {
    }

    @Transactional
    public CollectOutcome collect(UUID prescriptionId, CollectCommand command, UUID staffId) {
        DispensingActor actor = guard.requireDispenser(staffId);
        Prescription prescription = guard.loadPrescription(prescriptionId);

        List<PrescriptionItem> selected = selectItems(prescription, command);
        List<SkippedItem> skipped = new ArrayList<>();
        List<PrescriptionItem> handOver = new ArrayList<>();
        for (PrescriptionItem item : selected) {
            Optional<SkipReason> blocker = allocationService.findBlocker(prescription, item);
            blocker.ifPresentOrElse(reason -> skipped.add(new SkippedItem(item.getId(), item.getDrugName(), reason)),
                    () -> handOver.add(item));
        }

        collectionRules.validate(command, containsScheduledMedicine(handOver));
        if (handOver.isEmpty()) {
            return new CollectOutcome(null, List.of(), skipped);
        }

        List<HandedOverItem> handedOver = handOver.stream()
                .map(item -> dispenseInFull(prescription, item, actor, command.witness())).toList();
        var collectedAt = clock.instant();
        UUID collectionId = collectionRepository.save(
                new PrescriptionCollection(prescriptionId, command, actor.userId(), collectedAt)).getId();
        rollup.refresh(prescription);
        sendCollectedNotice(prescription, collectedAt);
        auditLogService.append(actor.userId(), prescription.getFacilityId(), "PRESCRIPTION_COLLECTED",
                "Prescription", prescriptionId.toString(), null,
                AuditDetails.of("handedOver", handedOver.size(), "skipped", skipped.size(),
                        "byPatient", command.collectedByPatient()));
        return new CollectOutcome(collectionId, handedOver, skipped);
    }

    private void sendCollectedNotice(Prescription prescription, java.time.Instant collectedAt) {
        if (patients == null || facilities == null || whatsAppNotifications == null) return;
        Patient patient = patients.findById(prescription.getPatientId()).orElse(null);
        Facility facility = facilities.findById(prescription.getFacilityId()).orElse(null);
        if (patient == null || facility == null) return;
        ZoneId zone = ZoneId.of(facility.getTimezone());
        var local = collectedAt.atZone(zone);
        String location = facility.getName();
        if (facility.getAddress() != null && !facility.getAddress().isBlank()) {
            location += ", " + facility.getAddress();
        }
        whatsAppNotifications.sendPatientAfterCommit(patient, WhatsAppMessageTemplate.MEDICATION_COLLECTED,
                java.util.Map.of("patient_first_name", patient.getFirstName(),
                        "collection_location", location,
                        "collection_reference", prescription.getSerialNumber(),
                        "collection_date", local.format(DateTimeFormatter.ofPattern("EEEE, d MMMM yyyy")),
                        "collection_time", local.format(DateTimeFormatter.ofPattern("HH:mm")) + " " + facility.getTimezone()),
                collectionIdReference(prescription));
    }

    private String collectionIdReference(Prescription prescription) {
        return prescription.getSerialNumber();
    }

    // Naming items hands over exactly those (including an out-of-stock item
    // whose stock has since arrived); naming none means everything still
    // pending, matching what "mark all as collected" always did. Sorted by id
    // so concurrent hand-overs lock item rows in the same order.
    private List<PrescriptionItem> selectItems(Prescription prescription, CollectCommand command) {
        List<PrescriptionItem> items = itemRepository.findByPrescriptionId(prescription.getId());
        boolean namedItems = command.itemIds() != null && !command.itemIds().isEmpty();
        List<PrescriptionItem> selected = namedItems
                ? namedItems(items, Set.copyOf(command.itemIds()))
                : items.stream().filter(item -> item.getStatus() == PrescriptionStatus.PENDING).toList();
        return selected.stream().sorted(Comparator.comparing(PrescriptionItem::getId)).toList();
    }

    private List<PrescriptionItem> namedItems(List<PrescriptionItem> items, Set<UUID> wantedIds) {
        List<PrescriptionItem> named = items.stream().filter(item -> wantedIds.contains(item.getId())).toList();
        if (named.size() != wantedIds.size()) {
            throw new PrescriptionItemNotFoundException();
        }
        return named;
    }

    private boolean containsScheduledMedicine(List<PrescriptionItem> items) {
        Set<UUID> productIds = items.stream().map(substitutionLookup::dispensingProductId)
                .collect(Collectors.toSet());
        return !scheduleLookup.schedulesFor(productIds).isEmpty();
    }

    private HandedOverItem dispenseInFull(Prescription prescription, PrescriptionItem item, DispensingActor actor,
                                          WitnessCredentials witness) {
        DispenseOutcome outcome = allocationService.dispense(prescription, item.getId(),
                DispenseRequest.remaining(witness), actor);
        return new HandedOverItem(item.getId(), item.getDrugName(), outcome.dispensedNow(), outcome.draws());
    }
}
