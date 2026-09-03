package co.ehealth.platform.pharmacy;

import co.ehealth.platform.core.audit.AuditLogService;
import co.ehealth.platform.core.tenant.ModuleCode;
import co.ehealth.platform.identity.PermissionLevel;
import co.ehealth.platform.identity.PermissionService;
import co.ehealth.platform.identity.StaffService;
import co.ehealth.platform.patient.Patient;
import co.ehealth.platform.patient.PatientService;
import co.ehealth.platform.visit.Visit;
import co.ehealth.platform.visit.VisitService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

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

    public PrescriptionService(PrescriptionRepository prescriptionRepository,
                                PrescriptionItemRepository prescriptionItemRepository,
                                DispensingRecordRepository dispensingRecordRepository,
                                StockMovementRepository stockMovementRepository, VisitService visitService,
                                PatientService patientService, ManualVerificationCaseRepository manualVerificationCases,
                                ManualVerificationService manualVerificationService, StaffService staffService,
                                AuditLogService auditLogService, Clock clock,
                                PermissionService permissionService) {
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
        return prescriptionRepository.findById(id).orElseThrow(PrescriptionNotFoundException::new);
    }

    public List<PrescriptionItem> getItems(UUID prescriptionId) {
        return prescriptionItemRepository.findByPrescriptionId(prescriptionId);
    }

    // PHRM-US-001 — the dispensing queue for one facility.
    public List<Prescription> listQueue(UUID facilityId) {
        permissionService.requireAccess(ModuleCode.PHRM, PermissionLevel.VIEW);
        return prescriptionRepository.findByFacilityIdAndStatusOrderByCreatedAtAsc(facilityId,
                PrescriptionStatus.PENDING);
    }

    public List<Prescription> list() {
        permissionService.requireAccess(ModuleCode.PHRM, PermissionLevel.VIEW);
        return prescriptionRepository.findAllByOrderByCreatedAtDesc();
    }

    public long countDispensedToday(UUID facilityId) {
        permissionService.requireAccess(ModuleCode.PHRM, PermissionLevel.VIEW);
        LocalDate today = LocalDate.now(clock.withZone(ZoneOffset.UTC));
        Instant startedAt = today.atStartOfDay(ZoneOffset.UTC).toInstant();
        return dispensingRecordRepository.countDispensedByFacilityBetween(facilityId, startedAt,
                startedAt.plusSeconds(24 * 60 * 60));
    }

    // PHRM-US-009's other half — dispensing requires a current SAPC
    // registration.
    @Transactional
    public void dispense(UUID prescriptionId, UUID dispenserId) {
        permissionService.requireAccess(ModuleCode.PHRM, PermissionLevel.MANAGE);
        if (!staffService.getLicenseStatus(dispenserId).canDispense()) {
            throw new NotLicensedException("You need a current SAPC registration to dispense.");
        }
        Prescription prescription = get(prescriptionId);
        if (prescription.getStatus() == PrescriptionStatus.DISPENSED) {
            throw new PrescriptionAlreadyDispensedException();
        }

        Patient patient;
        try {
            patient = requireValidMpi(prescription.getPatientId());
        } catch (PatientIdentityNotVerifiedException ex) {
            manualVerificationService.route(prescription, dispenserId, ex.getMessage(), clock.instant());
            throw ex;
        }

        prescription.markDispensed();
        prescriptionRepository.save(prescription);
        dispensingRecordRepository.save(new DispensingRecord(prescriptionId, patient.getId(), patient.getMpiNumber(),
                dispenserId, clock.instant()));
        for (PrescriptionItem item : prescriptionItemRepository.findByPrescriptionId(prescriptionId)) {
            stockMovementRepository.save(new StockMovement(prescriptionId, patient.getId(), patient.getMpiNumber(),
                    item.getDrugName(), item.getQuantity(), clock.instant()));
        }

        auditLogService.append(dispenserId, prescription.getFacilityId(), "PRESCRIPTION_DISPENSED", "Prescription",
                prescriptionId.toString(), null, null);
    }

    public record CreatePrescriptionCommand(UUID visitId, List<PrescriptionItemInput> items) {
    }

    public record PrescriptionItemInput(String drugName, String dosage, int quantity) {
    }

    public List<ManualVerificationCase> listManualVerificationCases() {
        permissionService.requireAccess(ModuleCode.PHRM, PermissionLevel.VIEW);
        return manualVerificationCases.findAllByOrderByCreatedAtAsc();
    }

    private Patient requireValidMpi(UUID patientId) {
        Patient patient = patientService.get(patientId);
        if (patient.getMpiNumber() == null || !patient.getMpiNumber().matches("MPI-\\d{7}")) {
            throw new PatientIdentityNotVerifiedException(
                    "Patient identity could not be verified. Complete manual verification before dispensing.");
        }
        return patient;
    }

}
