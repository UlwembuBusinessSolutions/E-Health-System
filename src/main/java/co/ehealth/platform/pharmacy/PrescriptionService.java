package co.ehealth.platform.pharmacy;

// lihle | 2026-09-09 | Scoped prescription and verification queries to the active clinic to protect patient records.

import co.ehealth.platform.core.audit.AuditLogService;
import co.ehealth.platform.core.clinic.ClinicContext;
import co.ehealth.platform.core.tenant.ModuleCode;
import co.ehealth.platform.facility.FacilityRepository;
import co.ehealth.platform.identity.PermissionLevel;
import co.ehealth.platform.identity.PermissionService;
import co.ehealth.platform.identity.StaffService;
import co.ehealth.platform.patient.Patient;
import co.ehealth.platform.patient.PatientService;
import co.ehealth.platform.visit.Visit;
import co.ehealth.platform.visit.VisitService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.beans.factory.annotation.Autowired;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;

@Service
public class PrescriptionService {

    private final PrescriptionRepository prescriptionRepository;
    private final PrescriptionItemRepository prescriptionItemRepository;
    private final DispensingRecordRepository dispensingRecordRepository;
    private final StockMovementRepository stockMovementRepository;
    private final VisitService visitService;
    private final PatientService patientService;
    private final ManualVerificationCaseRepository manualVerificationCases;
    private final ManualVerificationService manualVerificationService;
    private final StaffService staffService;
    private final AuditLogService auditLogService;
    private final Clock clock;
    private final PermissionService permissionService;
    private final ClinicalSafetyService clinicalSafetyService;
    @Autowired private PrescriptionDeclineRepository declineRepository;
    @Autowired private PrescriptionDeclineNotificationRepository declineNotifications;
    @Autowired private FacilityRepository facilityRepository;

    @Autowired
    public PrescriptionService(PrescriptionRepository prescriptionRepository,
                                PrescriptionItemRepository prescriptionItemRepository,
                                DispensingRecordRepository dispensingRecordRepository,
                                StockMovementRepository stockMovementRepository, VisitService visitService,
                                PatientService patientService, ManualVerificationCaseRepository manualVerificationCases,
                                ManualVerificationService manualVerificationService, StaffService staffService,
                                AuditLogService auditLogService, Clock clock,
                                PermissionService permissionService, ClinicalSafetyService clinicalSafetyService) {
        this.prescriptionRepository = prescriptionRepository;
        this.prescriptionItemRepository = prescriptionItemRepository;
        this.dispensingRecordRepository = dispensingRecordRepository;
        this.stockMovementRepository = stockMovementRepository;
        this.visitService = visitService;
        this.patientService = patientService;
        this.manualVerificationCases = manualVerificationCases;
        this.manualVerificationService = manualVerificationService;
        this.staffService = staffService;
        this.auditLogService = auditLogService;
        this.clock = clock;
        this.permissionService = permissionService;
        this.clinicalSafetyService = clinicalSafetyService;
    }

    // Retains the constructor used by earlier module tests/integrations. Production always receives
    // the clinical-safety service through the @Autowired constructor above.
    public PrescriptionService(PrescriptionRepository prescriptionRepository, PrescriptionItemRepository prescriptionItemRepository,
                               DispensingRecordRepository dispensingRecordRepository, StockMovementRepository stockMovementRepository,
                               VisitService visitService, PatientService patientService, ManualVerificationCaseRepository manualVerificationCases,
                               ManualVerificationService manualVerificationService, StaffService staffService, AuditLogService auditLogService,
                               Clock clock, PermissionService permissionService) {
        this(prescriptionRepository, prescriptionItemRepository, dispensingRecordRepository, stockMovementRepository, visitService,
                patientService, manualVerificationCases, manualVerificationService, staffService, auditLogService, clock,
                permissionService, null);
    }

    //  patientId/facilityId come from the visit,
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
        requireValidMpi(visit.getPatientId());

        List<ClinicalSafetyAlert> alerts = validateSafety(visit.getPatientId(), itemNames(cmd.items()), cmd.overrideReason(),
                prescriberId, visit.getFacilityId(), "PRESCRIBING");
        String serialNumber = "RX-" + String.format("%07d", prescriptionRepository.nextSerialSequenceValue());
        Prescription prescription = new Prescription(serialNumber, visit.getId(), visit.getPatientId(),
                visit.getFacilityId(), prescriberId, clock.instant());
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
        return prescriptionRepository.findByIdAndFacilityId(id, ClinicContext.require()).orElseThrow(PrescriptionNotFoundException::new);
    }

    public List<PrescriptionItem> getItems(UUID prescriptionId) {
        get(prescriptionId);
        return prescriptionItemRepository.findByPrescriptionId(prescriptionId);
    }

    // PHRM-US-001 — the dispensing queue for one facility.
    public List<Prescription> listQueue(UUID facilityId) {
        permissionService.requireAccess(ModuleCode.PHRM, PermissionLevel.VIEW);
        ClinicContext.requireFacility(facilityId);
        return prescriptionRepository.findByFacilityIdAndStatusOrderByCreatedAtAsc(facilityId,
                PrescriptionStatus.PENDING);
    }

    public List<Prescription> list() {
        permissionService.requireAccess(ModuleCode.PHRM, PermissionLevel.VIEW);
        return prescriptionRepository.findByFacilityIdOrderByCreatedAtDesc(ClinicContext.require());
    }

    public long countDispensedToday(UUID facilityId) {
        permissionService.requireAccess(ModuleCode.PHRM, PermissionLevel.VIEW);
        ClinicContext.requireFacility(facilityId);
        LocalDate today = LocalDate.now(clock.withZone(ZoneOffset.UTC));
        Instant startedAt = today.atStartOfDay(ZoneOffset.UTC).toInstant();
        return dispensingRecordRepository.countDispensedByFacilityBetween(facilityId, startedAt,
                startedAt.plusSeconds(24 * 60 * 60));
    }

    // PHRM-US-009's other half — dispensing requires a current SAPC
    // registration.
    @Transactional
    public void dispense(UUID prescriptionId, UUID dispenserId) {
        dispense(prescriptionId, dispenserId, null);
    }

    @Transactional
    public void dispense(UUID prescriptionId, UUID dispenserId, String overrideReason) {
        dispense(prescriptionId, dispenserId, overrideReason, null);
    }

    @Transactional
    public void dispense(UUID prescriptionId, UUID dispenserId, String overrideReason, LocalDate coverageUntil) {
        permissionService.requireAccess(ModuleCode.PHRM, PermissionLevel.MANAGE);
        if (!staffService.getLicenseStatus(dispenserId).canDispense()) {
            throw new NotLicensedException("You need a current SAPC registration to dispense.");
        }
        Prescription prescription = get(prescriptionId);
        if (prescription.getStatus() == PrescriptionStatus.HELD) {
            throw new PrescriptionOnHoldException();
        }
        if (prescription.getStatus() == PrescriptionStatus.DISPENSED || prescription.getStatus() == PrescriptionStatus.DECLINED) {
            throw new PrescriptionAlreadyDispensedException();
        }
        if (coverageUntil != null && coverageUntil.isBefore(LocalDate.now(clock.withZone(ZoneOffset.UTC)))) {
            throw new IllegalArgumentException("Coverage end date cannot be in the past.");
        }

        Patient patient;
        try {
            patient = requireValidMpi(prescription.getPatientId());
        } catch (PatientIdentityNotVerifiedException ex) {
            manualVerificationService.route(prescription, dispenserId, ex.getMessage(), clock.instant());
            throw ex;
        }
        validateSafety(patient.getId(), itemNames(prescriptionItemRepository.findByPrescriptionId(prescriptionId)), overrideReason,
                dispenserId, prescription.getFacilityId(), "DISPENSING");

        prescription.markDispensed();
        prescriptionRepository.save(prescription);
        dispensingRecordRepository.save(new DispensingRecord(prescriptionId, patient.getId(), patient.getMpiNumber(),
                dispenserId, clock.instant(), coverageUntil));
        for (PrescriptionItem item : prescriptionItemRepository.findByPrescriptionId(prescriptionId)) {
            stockMovementRepository.save(new StockMovement(prescriptionId, patient.getId(), patient.getMpiNumber(),
                    item.getDrugName(), item.getQuantity(), clock.instant()));
        }

        auditLogService.append(dispenserId, prescription.getFacilityId(), "PRESCRIPTION_DISPENSED", "Prescription",
                prescriptionId.toString(), null, null);
    }

    public List<ClinicalSafetyAlert> check(UUID patientId, List<PrescriptionItemInput> items) {
        permissionService.requireAccess(ModuleCode.PHRM, PermissionLevel.VIEW);
        requireValidMpi(patientId);
        return clinicalSafetyService == null ? List.of() : clinicalSafetyService.check(patientId, itemNames(items));
    }

    public record DuplicateDispensingWarning(UUID prescriptionId, String drugName, Instant dispensedAt,
                                              UUID facilityId, String facilityName, LocalDate coverageUntil) { }

    public List<DuplicateDispensingWarning> duplicateWarnings(UUID prescriptionId) {
        permissionService.requireAccess(ModuleCode.PHRM, PermissionLevel.VIEW);
        Prescription prescription = get(prescriptionId);
        List<String> requested = itemNames(prescriptionItemRepository.findByPrescriptionId(prescriptionId));
        return dispensingRecordRepository.findActiveForPatient(prescription.getPatientId(), prescriptionId,
                LocalDate.now(clock.withZone(ZoneOffset.UTC))).stream().flatMap(record -> {
            Prescription prior = prescriptionRepository.findById(record.getPrescriptionId()).orElseThrow();
            return prescriptionItemRepository.findByPrescriptionId(record.getPrescriptionId()).stream()
                    .filter(item -> requested.stream().anyMatch(name -> name.equalsIgnoreCase(item.getDrugName())))
                    .map(item -> new DuplicateDispensingWarning(record.getPrescriptionId(), item.getDrugName(),
                            record.getDispensedAt(), prior.getFacilityId(),
                            facilityRepository.findById(prior.getFacilityId()).map(f -> f.getName()).orElse("Unknown facility"),
                            record.getCoverageUntil()));
        }).toList();
    }

    @Transactional
    public PrescriptionDecline decline(UUID prescriptionId, UUID pharmacistId, DeclineReasonCode reasonCode, String detail) {
        permissionService.requireAccess(ModuleCode.PHRM, PermissionLevel.MANAGE);
        if (!staffService.getLicenseStatus(pharmacistId).canDispense()) throw new NotLicensedException("You need a current SAPC registration to decline dispensing.");
        if (reasonCode == null) throw new IllegalArgumentException("A decline reason code is required.");
        if (reasonCode == DeclineReasonCode.OTHER && (detail == null || detail.isBlank())) throw new IllegalArgumentException("A reason detail is required for OTHER.");
        if (detail != null && detail.length() > 1000) throw new IllegalArgumentException("Reason detail exceeds 1000 characters.");
        Prescription prescription = get(prescriptionId);
        if (prescription.getStatus() != PrescriptionStatus.PENDING) throw new IllegalStateException("Only pending prescriptions can be declined.");
        prescription.decline();
        prescriptionRepository.save(prescription);
        Instant now = clock.instant();
        PrescriptionDecline decline = declineRepository.save(new PrescriptionDecline(prescription, pharmacistId, reasonCode,
                detail == null ? null : detail.trim(), now));
        declineNotifications.save(new PrescriptionDeclineNotification(decline.getId(), prescriptionId, prescription.getPrescriberId(), now));
        auditLogService.append(pharmacistId, prescription.getFacilityId(), "PRESCRIPTION_DECLINED", "Prescription",
                prescriptionId.toString(), null, "{\"reasonCode\":\"" + reasonCode + "\"}");
        return decline;
    }

    public PrescriptionDecline getDecline(UUID prescriptionId) {
        permissionService.requireAccess(ModuleCode.PHRM, PermissionLevel.VIEW);
        get(prescriptionId);
        return declineRepository.findByPrescriptionIdAndFacilityId(prescriptionId, ClinicContext.require()).orElseThrow();
    }

    public List<PrescriptionDeclineNotification> declineNotifications(UUID prescriberId) {
        permissionService.requireAccess(ModuleCode.PHRM, PermissionLevel.VIEW);
        return declineNotifications.findByRecipientUserIdOrderByCreatedAtDesc(prescriberId);
    }

    public record CreatePrescriptionCommand(UUID visitId, List<PrescriptionItemInput> items, String overrideReason) {
        public CreatePrescriptionCommand(UUID visitId, List<PrescriptionItemInput> items) { this(visitId, items, null); }
    }

    public record PrescriptionItemInput(String drugName, String dosage, int quantity) {
    }

    public List<ManualVerificationCase> listManualVerificationCases() {
        permissionService.requireAccess(ModuleCode.PHRM, PermissionLevel.VIEW);
        return manualVerificationCases.findInClinic(ClinicContext.require());
    }

    private Patient requireValidMpi(UUID patientId) {
        Patient patient = patientService.get(patientId);
        if (patient.getMpiNumber() == null || !patient.getMpiNumber().matches("MPI-\\d{7}")) {
            throw new PatientIdentityNotVerifiedException(
                    "Patient identity could not be verified. Complete manual verification before dispensing.");
        }
        return patient;
    }

    private List<ClinicalSafetyAlert> validateSafety(UUID patientId, List<String> drugNames, String overrideReason,
                                                       UUID actorId, UUID facilityId, String stage) {
        if (clinicalSafetyService == null) return List.of();
        List<ClinicalSafetyAlert> alerts = clinicalSafetyService.check(patientId, drugNames);
        boolean blocked = alerts.stream().anyMatch(alert -> alert.severity().requiresOverride());
        if (blocked && (overrideReason == null || overrideReason.isBlank())) throw new ClinicalSafetyBlockedException(alerts);
        if (!alerts.isEmpty()) {
            String action = blocked ? "CLINICAL_ALERT_OVERRIDDEN" : "CLINICAL_ALERT_REVIEWED";
            String after = "{\"stage\":\"" + stage + "\",\"overrideReason\":"
                    + (blocked ? "\"" + overrideReason.trim().replace("\"", "\\\"") + "\"" : "null") + "}";
            auditLogService.append(actorId, facilityId, action, "ClinicalSafetyAlert", patientId.toString(), null, after);
        }
        return alerts;
    }

    private List<String> itemNames(List<PrescriptionItemInput> items) { return items.stream().map(PrescriptionItemInput::drugName).toList(); }
    private List<String> itemNames(java.util.Collection<PrescriptionItem> items) { return items.stream().map(PrescriptionItem::getDrugName).toList(); }

}
