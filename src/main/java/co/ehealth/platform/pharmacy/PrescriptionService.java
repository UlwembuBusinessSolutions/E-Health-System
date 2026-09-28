package co.ehealth.platform.pharmacy;

import co.ehealth.platform.core.audit.AuditLogService;
import co.ehealth.platform.core.notification.EmailService;
import co.ehealth.platform.core.tenant.ModuleCode;
import co.ehealth.platform.core.tenant.Organization;
import co.ehealth.platform.core.tenant.OrganizationRepository;
import co.ehealth.platform.core.tenant.TenantContext;
import co.ehealth.platform.identity.PermissionLevel;
import co.ehealth.platform.identity.PermissionService;
import co.ehealth.platform.identity.StaffService;
import co.ehealth.platform.identity.User;
import co.ehealth.platform.identity.UserRepository;
import co.ehealth.platform.visit.Visit;
import co.ehealth.platform.visit.VisitService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
public class PrescriptionService {

    private final PrescriptionRepository prescriptionRepository;
    private final PrescriptionItemRepository prescriptionItemRepository;
    private final DispensingRecordRepository dispensingRecordRepository;
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

    public PrescriptionService(PrescriptionRepository prescriptionRepository,
                                PrescriptionItemRepository prescriptionItemRepository,
                                DispensingRecordRepository dispensingRecordRepository,
                                PrescriptionOutOfStockRecordRepository outOfStockRecordRepository,
                                PrescriberMessageRepository prescriberMessageRepository, VisitService visitService,
                                StaffService staffService, UserRepository userRepository,
                                OrganizationRepository organizationRepository, EmailService emailService,
                                AuditLogService auditLogService, Clock clock, PermissionService permissionService) {
        this.prescriptionRepository = prescriptionRepository;
        this.prescriptionItemRepository = prescriptionItemRepository;
        this.dispensingRecordRepository = dispensingRecordRepository;
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

        String serialNumber = "RX-" + String.format("%07d", prescriptionRepository.nextSerialSequenceValue());
        Prescription prescription = new Prescription(serialNumber, visit.getId(), visit.getPatientId(),
                visit.getFacilityId(), prescriberId, clock.instant(), cmd.consultationId());
        prescriptionRepository.save(prescription);

        for (PrescriptionItemInput item : cmd.items()) {
            prescriptionItemRepository.save(
                    new PrescriptionItem(prescription.getId(), item.drugName(), item.dosage(), item.quantity()));
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

    public Optional<DispensingRecord> getDispensingRecord(UUID prescriptionItemId) {
        return dispensingRecordRepository.findByPrescriptionItemId(prescriptionItemId);
    }

    public Optional<PrescriptionOutOfStockRecord> getOutOfStockRecord(UUID prescriptionItemId) {
        return outOfStockRecordRepository.findByPrescriptionItemId(prescriptionItemId);
    }

    // PHRM-US-009's other half — dispensing requires a current SAPC
    // registration. Reversible the other way: an item already OUT_OF_STOCK
    // can still be dispensed here once stock is back (that's the whole
    // point of getBySerialNumber() above) — only an already-DISPENSED item
    // is refused.
    @Transactional
    public void dispenseItem(UUID prescriptionId, UUID itemId, UUID dispenserId) {
        permissionService.requireAccess(ModuleCode.PHRM, PermissionLevel.MANAGE);
        if (!staffService.getLicenseStatus(dispenserId).canDispense()) {
            throw new NotLicensedException("You need a current SAPC registration to dispense.");
        }
        Prescription prescription = get(prescriptionId);
        PrescriptionItem item = requireOwnedItem(prescription, itemId);
        dispenseItemInternal(prescription, item, dispenserId);
        recomputeAndSave(prescription);
    }

    // "Mark all as collected" — dispenses every item still PENDING on this
    // prescription in one action; an item already OUT_OF_STOCK is left
    // alone (there's nothing to hand over until stock is actually back —
    // this must never silently fabricate a dispense for something the
    // pharmacy doesn't have).
    @Transactional
    public void dispenseAllPending(UUID prescriptionId, UUID dispenserId) {
        permissionService.requireAccess(ModuleCode.PHRM, PermissionLevel.MANAGE);
        if (!staffService.getLicenseStatus(dispenserId).canDispense()) {
            throw new NotLicensedException("You need a current SAPC registration to dispense.");
        }
        Prescription prescription = get(prescriptionId);
        List<PrescriptionItem> items = getItems(prescriptionId);
        for (PrescriptionItem item : items) {
            if (item.getStatus() == PrescriptionStatus.PENDING) {
                dispenseItemInternal(prescription, item, dispenserId);
            }
        }
        recomputeAndSave(prescription);
    }

    private void dispenseItemInternal(Prescription prescription, PrescriptionItem item, UUID dispenserId) {
        if (item.getStatus() == PrescriptionStatus.DISPENSED) {
            throw new PrescriptionAlreadyDispensedException();
        }
        item.markDispensed();
        prescriptionItemRepository.save(item);
        dispensingRecordRepository.save(new DispensingRecord(item.getId(), dispenserId, clock.instant()));
        auditLogService.append(dispenserId, prescription.getFacilityId(), "PRESCRIPTION_ITEM_DISPENSED",
                "PrescriptionItem", item.getId().toString(), null, null);
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
        recomputeAndSave(prescription);

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

    private void recomputeAndSave(Prescription prescription) {
        prescription.recomputeStatus(getItems(prescription.getId()));
        prescriptionRepository.save(prescription);
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
    public record CreatePrescriptionCommand(UUID visitId, List<PrescriptionItemInput> items, UUID consultationId) {
    }

    public record PrescriptionItemInput(String drugName, String dosage, int quantity) {
    }
}
