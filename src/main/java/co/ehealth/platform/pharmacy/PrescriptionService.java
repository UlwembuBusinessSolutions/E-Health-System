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
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.multipart.MultipartFile;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.services.s3.presigner.model.GetObjectPresignRequest;

import java.time.Clock;
import java.time.Instant;
import java.time.Duration;
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
    private final S3Client s3Client;
    private final S3Presigner s3Presigner;
    private final String bucketName;

    public PrescriptionService(PrescriptionRepository prescriptionRepository,
                                PrescriptionItemRepository prescriptionItemRepository,
                                DispensingRecordRepository dispensingRecordRepository,
                                PrescriptionOutOfStockRecordRepository outOfStockRecordRepository,
                                PrescriberMessageRepository prescriberMessageRepository, VisitService visitService,
                                StaffService staffService, UserRepository userRepository,
                                OrganizationRepository organizationRepository, EmailService emailService,
                                AuditLogService auditLogService, Clock clock, PermissionService permissionService,
                                S3Client s3Client, S3Presigner s3Presigner,
                                @Value("${app.storage.bucket-name}") String bucketName) {
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
        this.s3Client = s3Client;
        this.s3Presigner = s3Presigner;
        this.bucketName = bucketName;
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
                    new PrescriptionItem(prescription.getId(), item.drugName(), item.dosage(), item.quantity(), item.schedule()));
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

    @Transactional
    public void confirmCollection(UUID prescriptionId, List<UUID> itemIds, CollectionCommand cmd,
                                  MultipartFile proof, MultipartFile signature, UUID staffId) {
        permissionService.requireAccess(ModuleCode.PHRM, PermissionLevel.MANAGE);
        if (!staffService.getLicenseStatus(staffId).canDispense()) {
            throw new NotLicensedException("You need a current SAPC registration to dispense.");
        }
        if (itemIds == null || itemIds.isEmpty() || itemIds.stream().distinct().count() != itemIds.size()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Choose at least one unique prescription item.");
        }
        Prescription prescription = get(prescriptionId);
        String proofKey = null;
        String signatureKey = null;
        boolean controlled = itemIds.stream().map(this::getItem)
                .anyMatch(item -> item.getPrescriptionId().equals(prescriptionId)
                        && item.getSchedule() != null && item.getSchedule() >= 5);
        if (!cmd.collectedByPatient()) {
            if (!StringUtils.hasText(cmd.collectorName()) || !StringUtils.hasText(cmd.idType())
                    || !StringUtils.hasText(cmd.idNumber()) || !StringUtils.hasText(cmd.relationship())
                    || !StringUtils.hasText(cmd.contactNumber()) || !StringUtils.hasText(cmd.authorisationType())
                    || !cmd.idChecked() || signature == null || signature.isEmpty()) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Collector identity, relationship, contact, authorisation, ID check and signature are required.");
            }
            if (controlled && (!"WRITTEN_CONSENT_LETTER".equals(cmd.authorisationType())
                    || proof == null || proof.isEmpty())) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Schedule 5 or higher medication requires uploaded written authorisation.");
            }
            if (proof != null && !proof.isEmpty()) proofKey = uploadCollectionFile(prescriptionId, proof, false);
            signatureKey = uploadCollectionFile(prescriptionId, signature, true);
        }
        for (UUID itemId : itemIds) {
            PrescriptionItem item = requireOwnedItem(prescription, itemId);
            if (item.getStatus() == PrescriptionStatus.DISPENSED) throw new PrescriptionAlreadyDispensedException();
            item.markDispensed();
            prescriptionItemRepository.save(item);
            DispensingRecord record = new DispensingRecord(item.getId(), staffId, clock.instant());
            if (!cmd.collectedByPatient()) {
                record.recordThirdPartyCollection(cmd.collectorName().trim(), cmd.idType(), cmd.idNumber().trim(),
                        cmd.relationship(), cmd.contactNumber().trim(), cmd.authorisationType(), proofKey,
                        signatureKey, staffId, cmd.notes());
            }
            dispensingRecordRepository.save(record);
            auditLogService.append(staffId, prescription.getFacilityId(), "PRESCRIPTION_ITEM_DISPENSED",
                    "PrescriptionItem", item.getId().toString(), null, null);
        }
        recomputeAndSave(prescription);
    }

    private String uploadCollectionFile(UUID prescriptionId, MultipartFile file, boolean signature) {
        String type = file.getContentType();
        boolean valid = signature ? "image/png".equals(type) || "image/jpeg".equals(type)
                : "application/pdf".equals(type) || "image/png".equals(type) || "image/jpeg".equals(type);
        if (!valid || file.getSize() > 10 * 1024 * 1024) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    signature ? "Signature must be PNG or JPEG (maximum 10 MB)." : "Proof must be PDF, PNG or JPEG (maximum 10 MB).");
        }
        String key = "pharmacy-collection/%s/%s/%s".formatted(TenantContext.getCurrentTenant(), prescriptionId, UUID.randomUUID());
        try {
            s3Client.putObject(PutObjectRequest.builder().bucket(bucketName).key(key).contentType(type).build(),
                    RequestBody.fromInputStream(file.getInputStream(), file.getSize()));
        } catch (java.io.IOException e) {
            throw new java.io.UncheckedIOException("Could not store collection evidence.", e);
        }
        return key;
    }

    public CollectionDetails getCollectionDetails(UUID itemId, UUID viewerId) {
        permissionService.requireAccess(ModuleCode.PHRM, PermissionLevel.VIEW);
        permissionService.requireAnyRole(java.util.Set.of("Pharmacist", "ORG_ADMIN"),
                "Only pharmacists and organization administrators can view collector identity details.");
        PrescriptionItem item = getItem(itemId);
        DispensingRecord record = dispensingRecordRepository.findByPrescriptionItemId(itemId)
                .orElseThrow(PrescriptionItemNotFoundException::new);
        if (record.isCollectedByPatient()) throw new PrescriptionItemNotFoundException();
        Prescription prescription = prescriptionRepository.findById(item.getPrescriptionId())
                .orElseThrow(PrescriptionNotFoundException::new);
        auditLogService.append(viewerId, prescription.getFacilityId(), "PRESCRIPTION_COLLECTION_DETAILS_VIEWED",
                "PrescriptionItem", itemId.toString(), null, null);
        return new CollectionDetails(record.isCollectedByPatient(), record.getCollectorName(), record.getCollectorIdType(),
                record.getCollectorIdNumber(), record.getCollectorRelationship(), record.getCollectorContactNumber(),
                record.getAuthorisationType(), presign(record.getProofS3Key()), presign(record.getSignatureS3Key()), record.getIdCheckedByUserId(),
                record.getCollectionNotes(), record.getDispensedAt(), record.getDispensedByUserId(), prescription.getFacilityId());
    }

    private String presign(String key) {
        if (key == null) return null;
        var request = GetObjectPresignRequest.builder().signatureDuration(Duration.ofMinutes(5))
                .getObjectRequest(GetObjectRequest.builder().bucket(bucketName).key(key).build()).build();
        return s3Presigner.presignGetObject(request).url().toString();
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

    public record PrescriptionItemInput(String drugName, String dosage, int quantity, Integer schedule) {
        public PrescriptionItemInput(String drugName, String dosage, int quantity) {
            this(drugName, dosage, quantity, null);
        }
    }

    public record CollectionCommand(boolean collectedByPatient, String collectorName, String idType, String idNumber,
                                     String relationship, String contactNumber, String authorisationType,
                                     boolean idChecked, String notes) { }

    public record CollectionDetails(boolean collectedByPatient, String collectorName, String idType, String idNumber,
                                    String relationship, String contactNumber, String authorisationType,
                                    String proofUrl, String signatureUrl, UUID idCheckedByUserId, String notes, Instant collectedAt,
                                    UUID collectedByUserId, UUID facilityId) { }
}
