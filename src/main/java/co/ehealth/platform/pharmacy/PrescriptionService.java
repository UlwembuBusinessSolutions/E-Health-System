package co.ehealth.platform.pharmacy;

import co.ehealth.platform.core.audit.AuditLogService;
import co.ehealth.platform.core.notification.EmailService;
import co.ehealth.platform.core.tenant.ModuleCode;
import co.ehealth.platform.core.tenant.OrganizationRepository;
import co.ehealth.platform.core.tenant.TenantContext;
import co.ehealth.platform.identity.PermissionLevel;
import co.ehealth.platform.identity.PermissionService;
import co.ehealth.platform.identity.StaffService;
import co.ehealth.platform.identity.User;
import co.ehealth.platform.identity.UserRepository;
import co.ehealth.platform.pharmacy.prescribing.PrescribingStockService;
import co.ehealth.platform.pharmacy.stock.PharmacyValidationException;
import co.ehealth.platform.pharmacy.dispensing.DispenseAllocationService;
import co.ehealth.platform.pharmacy.dispensing.DispenseAllocationService.DispenseOutcome;
import co.ehealth.platform.pharmacy.dispensing.DispenseAllocationService.DispenseRequest;
import co.ehealth.platform.pharmacy.dispensing.DispensingActor;
import co.ehealth.platform.pharmacy.dispensing.DispensingGuard;
import co.ehealth.platform.pharmacy.dispensing.DrugMappingService;
import co.ehealth.platform.pharmacy.dispensing.ItemLock;
import co.ehealth.platform.pharmacy.dispensing.PrescriptionRollup;
import co.ehealth.platform.visit.Visit;
import co.ehealth.platform.visit.VisitService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.Clock;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class PrescriptionService {

    private final PrescriptionRepository prescriptionRepository;
    private final PrescriptionItemRepository prescriptionItemRepository;
    private final PrescriptionOutOfStockRecordRepository outOfStockRecordRepository;
    private final PrescriberMessageRepository prescriberMessageRepository;
    private final VisitService visitService;
    private final StaffService staffService;
    private final UserRepository userRepository;
    private final OrganizationRepository organizationRepository;
    private final EmailService emailService;
    private final AuditLogService auditLogService;
    private final Clock clock;
    private final PermissionService permissionService;
    private final DispensingGuard dispensingGuard;
    private final DispenseAllocationService dispenseAllocationService;
    private final DrugMappingService drugMappingService;
    private final PrescriptionRollup prescriptionRollup;
    private final ItemLock itemLock;
    private final PrescriptionPurchaseItemRepository purchaseItemRepository;
    private final PrescribingStockService prescribingStock;

    public PrescriptionService(PrescriptionRepository prescriptionRepository,
                                PrescriptionItemRepository prescriptionItemRepository,
                                PrescriptionOutOfStockRecordRepository outOfStockRecordRepository,
                                PrescriberMessageRepository prescriberMessageRepository, VisitService visitService,
                                StaffService staffService, UserRepository userRepository,
                                OrganizationRepository organizationRepository, EmailService emailService,
                                AuditLogService auditLogService, Clock clock, PermissionService permissionService,
                                DispensingGuard dispensingGuard, DispenseAllocationService dispenseAllocationService,
                                DrugMappingService drugMappingService, PrescriptionRollup prescriptionRollup,
                                ItemLock itemLock, PrescriptionPurchaseItemRepository purchaseItemRepository,
                                PrescribingStockService prescribingStock) {
        this.purchaseItemRepository = purchaseItemRepository;
        this.prescribingStock = prescribingStock;
        this.prescriptionRepository = prescriptionRepository;
        this.prescriptionItemRepository = prescriptionItemRepository;
        this.outOfStockRecordRepository = outOfStockRecordRepository;
        this.prescriberMessageRepository = prescriberMessageRepository;
        this.visitService = visitService;
        this.staffService = staffService;
        this.userRepository = userRepository;
        this.organizationRepository = organizationRepository;
        this.emailService = emailService;
        this.auditLogService = auditLogService;
        this.clock = clock;
        this.permissionService = permissionService;
        this.dispensingGuard = dispensingGuard;
        this.dispenseAllocationService = dispenseAllocationService;
        this.drugMappingService = drugMappingService;
        this.prescriptionRollup = prescriptionRollup;
        this.itemLock = itemLock;
    }

    // PHRM-US-018 + PHRM-US-009 — patientId/facilityId come from the visit,
    // never a second independently-supplied value (Prescription's own
    // why-note on why that's the safer MPI-binding path); the prescriber
    // must currently hold a valid HPCSA or SANC registration
    // (StaffService.getLicenseStatus()), checked fresh on every call.
    @Transactional
    public Prescription create(CreatePrescriptionCommand cmd, UUID prescriberId) {
        permissionService.requireAccess(ModuleCode.PHRM, PermissionLevel.MANAGE);
        if (!staffService.getLicenseStatus(prescriberId).canPrescribe()) {
            throw new NotLicensedException(
                    "You need a current HPCSA or SANC registration to prescribe.");
        }
        Visit visit = visitService.get(cmd.visitId());
        List<PrescriptionPurchaseItemInput> purchaseInputs = cmd.purchaseItems();
        if (cmd.items().isEmpty() && purchaseInputs.isEmpty()) {
            throw new PharmacyValidationException("A prescription needs at least one medicine.");
        }
        // The pharmacy may only be asked for what it holds: checked here, inside the
        // sign transaction, so a prescription can never leave the consulting room
        // promising stock that is not there.
        prescribingStock.requireCovered(visit.getFacilityId(), cmd.items().stream()
                .filter(item -> item.productId() != null)
                .map(item -> new PrescribingStockService.StockLine(item.productId(), item.quantity())).toList());

        String serialNumber = "RX-" + String.format("%07d", prescriptionRepository.nextSerialSequenceValue());
        Prescription prescription = new Prescription(serialNumber, visit.getId(), visit.getPatientId(),
                visit.getFacilityId(), prescriberId, clock.instant(), cmd.consultationId());
        if (cmd.items().isEmpty()) {
            // Everything on it is for the patient to buy, so the pharmacy has nothing to hand over.
            prescription.markNothingToDispense();
        }
        prescriptionRepository.save(prescription);

        for (PrescriptionItemInput item : cmd.items()) {
            PrescriptionItem saved = new PrescriptionItem(prescription.getId(), item.drugName(), item.dosage(),
                    item.quantity());
            if (item.productId() != null) {
                // The prescriber picked the product from the pharmacy's list, so the
                // pharmacist never has to match the name to a product by hand.
                saved.mapToProduct(item.productId());
            }
            prescriptionItemRepository.save(saved);
        }
        Map<UUID, Integer> dispensedByProduct = cmd.items().stream().filter(item -> item.productId() != null)
                .collect(Collectors.groupingBy(PrescriptionItemInput::productId,
                        Collectors.summingInt(PrescriptionItemInput::quantity)));
        for (PrescriptionPurchaseItemInput item : purchaseInputs) {
            int alreadyDispensed = item.productId() == null ? 0 : dispensedByProduct.getOrDefault(item.productId(), 0);
            purchaseItemRepository.save(new PrescriptionPurchaseItem(prescription.getId(), item.drugName(),
                    item.dosage(), item.quantity(), item.productId(),
                    prescribingStock.classifyPurchase(visit.getFacilityId(), item.productId(), item.quantity(),
                            alreadyDispensed),
                    item.note()));
        }

        auditLogService.append(prescriberId, visit.getFacilityId(), "PRESCRIPTION_CREATED", "Prescription",
                prescription.getId().toString(), null, null);

        return prescription;
    }

    public Prescription get(UUID id) {
        permissionService.requireAccess(ModuleCode.PHRM, PermissionLevel.VIEW);
        return prescriptionRepository.findById(id).orElseThrow(PrescriptionNotFoundException::new);
    }

    // The pharmacy "look up a prescription" utility — finds one by its
    // human-facing serial number (what a pharmacist actually has on hand,
    // not a UUID) regardless of status, so a prescription that fell off the
    // active queue (PrescriptionRepository's own why-note) can still be
    // found and finished once stock is back.
    public Prescription getBySerialNumber(String serialNumber) {
        permissionService.requireAccess(ModuleCode.PHRM, PermissionLevel.VIEW);
        return prescriptionRepository.findBySerialNumber(serialNumber).orElseThrow(PrescriptionNotFoundException::new);
    }

    public List<PrescriptionItem> getItems(UUID prescriptionId) {
        return prescriptionItemRepository.findByPrescriptionId(prescriptionId);
    }

    private PrescriptionItem getItem(UUID itemId) {
        return prescriptionItemRepository.findById(itemId).orElseThrow(PrescriptionItemNotFoundException::new);
    }

    // PHRM-US-001 — the dispensing queue for one facility. PARTIALLY_DISPENSED
    // included alongside PENDING so a prescription with some items already
    // resolved stays visible as long as at least one item still needs action.
    public List<Prescription> listQueue(UUID facilityId) {
        permissionService.requireAccess(ModuleCode.PHRM, PermissionLevel.VIEW);
        return prescriptionRepository.findByFacilityIdAndStatusInOrderByCreatedAtAsc(facilityId,
                List.of(PrescriptionStatus.PENDING, PrescriptionStatus.PARTIALLY_DISPENSED));
    }

    // The patient-level Medication tab (PatientDetailPage) — every
    // prescription this patient has ever had, across every visit, every
    // status alike, so staff can see the complete history and whether each
    // one was actually taken — same "read access only needs VIEW" reasoning
    // as listQueue() above.
    public List<Prescription> getPatientPrescriptions(UUID patientId) {
        permissionService.requireAccess(ModuleCode.PHRM, PermissionLevel.VIEW);
        return prescriptionRepository.findByPatientIdOrderByCreatedAtDesc(patientId);
    }

    // PHRM-US-009's other half — dispensing requires a current SAPC
    // registration (DispensingGuard). Reversible the other way: an item
    // already OUT_OF_STOCK can still be dispensed here once stock is back
    // (that's the whole point of getBySerialNumber() above) — only an
    // already-DISPENSED item is refused. The stock deduction, lot
    // allocation and dispensing record are DispenseAllocationService's job;
    // this only adds the prescription-level status rollup.
    @Transactional
    public DispenseOutcome dispenseItem(UUID prescriptionId, UUID itemId, DispenseRequest request,
                                         UUID dispenserId) {
        DispensingActor actor = dispensingGuard.requireDispenser(dispenserId);
        Prescription prescription = dispensingGuard.loadPrescription(prescriptionId);
        DispenseOutcome outcome = dispenseAllocationService.dispense(prescription, itemId, request, actor);
        prescriptionRollup.refresh(prescription);
        return outcome;
    }

    // A pharmacist confirms (or overrides) which stock product backs this
    // line; the choice is remembered for the same drug name next time.
    @Transactional
    public Prescription confirmProduct(UUID prescriptionId, UUID itemId, UUID productId, UUID staffId) {
        DispensingActor actor = dispensingGuard.requireManager(staffId);
        Prescription prescription = dispensingGuard.loadPrescription(prescriptionId);
        PrescriptionItem item = itemLock.lockOwnedItem(prescription, itemId);
        if (item.getStatus() == PrescriptionStatus.DISPENSED) {
            throw new PrescriptionAlreadyDispensedException();
        }
        drugMappingService.confirmProduct(prescription, item, productId, actor.userId());
        return prescription;
    }

    // The other outcome for a PENDING item — the pharmacy doesn't have the
    // stock to fill it. Deliberately no SAPC-registration check unlike
    // dispensing: saying "we don't have this in stock" doesn't require a
    // dispensing licence the way actually handing over medicine does; any
    // staff member with PHRM:MANAGE can flag it. Idempotent on an item
    // already OUT_OF_STOCK — re-marking just updates who/when/why
    // (PrescriptionOutOfStockRecord.update()) rather than erroring, since a
    // pharmacist may want to update the note while still waiting on stock.
    // Never deletes the item or the prescription — status changes,
    // everything else about what was prescribed stays on the record.
    @Transactional
    public void markItemOutOfStock(UUID prescriptionId, UUID itemId, UUID staffId, String note) {
        permissionService.requireAccess(ModuleCode.PHRM, PermissionLevel.MANAGE);
        Prescription prescription = get(prescriptionId);
        PrescriptionItem item = requireOwnedItem(prescription, itemId);
        if (item.getStatus() == PrescriptionStatus.DISPENSED) {
            throw new PrescriptionAlreadyDispensedException();
        }

        item.markOutOfStock();
        prescriptionItemRepository.save(item);
        Optional<PrescriptionOutOfStockRecord> existing = outOfStockRecordRepository.findByPrescriptionItemId(itemId);
        if (existing.isPresent()) {
            existing.get().update(staffId, clock.instant(), note);
            outOfStockRecordRepository.save(existing.get());
        } else {
            outOfStockRecordRepository.save(new PrescriptionOutOfStockRecord(itemId, staffId, clock.instant(), note));
        }
        prescriptionRollup.refresh(prescription);

        auditLogService.append(staffId, prescription.getFacilityId(), "PRESCRIPTION_ITEM_MARKED_OUT_OF_STOCK",
                "PrescriptionItem", itemId.toString(), null, null);
    }

    private PrescriptionItem requireOwnedItem(Prescription prescription, UUID itemId) {
        PrescriptionItem item = getItem(itemId);
        if (!item.getPrescriptionId().equals(prescription.getId())) {
            throw new PrescriptionItemNotFoundException();
        }
        return item;
    }

    // "Something else" — a pharmacy query about this prescription that
    // isn't a stock or dispensing action (a dosage concern, missing
    // information, anything needing the prescriber's own judgment). Always
    // paired with a real email; the row this saves is the pharmacy's own
    // durable record of having asked, independent of whether that email is
    // ever opened.
    @Transactional
    public PrescriberMessage sendPrescriberMessage(UUID prescriptionId, UUID senderId, String message) {
        permissionService.requireAccess(ModuleCode.PHRM, PermissionLevel.VIEW);
        if (!StringUtils.hasText(message)) {
            throw new InvalidPrescriberMessageException("A message is required.");
        }
        Prescription prescription = get(prescriptionId);
        User sender = userRepository.findById(senderId).orElseThrow(PrescriptionNotFoundException::new);
        User prescriber = userRepository.findById(prescription.getPrescriberId())
                .orElseThrow(PrescriptionNotFoundException::new);

        PrescriberMessage saved = prescriberMessageRepository.save(
                new PrescriberMessage(prescriptionId, senderId, message.trim(), clock.instant()));

        organizationRepository.findBySchemaName(TenantContext.getCurrentTenant())
                .ifPresent(organization -> emailService.sendPrescriberQueryEmail(prescriber.getEmail(),
                        prescriber.getFirstName(), organization.getDisplayName(), sender.getFirstName() + " "
                                + sender.getLastName(), prescription.getSerialNumber(), message.trim()));

        auditLogService.append(senderId, prescription.getFacilityId(), "PRESCRIPTION_PRESCRIBER_MESSAGED",
                "Prescription", prescriptionId.toString(), null, null);
        return saved;
    }

    public List<PrescriberMessage> getPrescriberMessages(UUID prescriptionId) {
        permissionService.requireAccess(ModuleCode.PHRM, PermissionLevel.VIEW);
        return prescriberMessageRepository.findByPrescriptionIdOrderBySentAtAsc(prescriptionId);
    }

    // consultationId is optional traceability only (Prescription's own
    // why-note) — null keeps this call's behaviour identical to before it
    // existed.
    public record CreatePrescriptionCommand(UUID visitId, List<PrescriptionItemInput> items, UUID consultationId,
                                            List<PrescriptionPurchaseItemInput> purchaseItems) {

        public CreatePrescriptionCommand {
            items = items == null ? List.of() : items;
            purchaseItems = purchaseItems == null ? List.of() : purchaseItems;
        }

        public CreatePrescriptionCommand(UUID visitId, List<PrescriptionItemInput> items, UUID consultationId) {
            this(visitId, items, consultationId, List.of());
        }
    }

    // productId is set when the prescriber chose the medicine from the pharmacy's
    // stock list; null for a typed name the pharmacist will match later.
    public record PrescriptionItemInput(String drugName, String dosage, int quantity, UUID productId) {

        public PrescriptionItemInput(String drugName, String dosage, int quantity) {
            this(drugName, dosage, quantity, null);
        }
    }

    // A medicine the patient should buy rather than receive from the pharmacy.
    public record PrescriptionPurchaseItemInput(String drugName, String dosage, int quantity, UUID productId,
                                                String note) {
    }
}
