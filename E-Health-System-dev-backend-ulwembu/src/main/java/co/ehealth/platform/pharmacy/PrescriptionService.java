package co.ehealth.platform.pharmacy;

import co.ehealth.platform.core.audit.AuditLogService;
import co.ehealth.platform.core.tenant.ModuleCode;
import co.ehealth.platform.identity.PermissionLevel;
import co.ehealth.platform.identity.PermissionService;
import co.ehealth.platform.identity.StaffService;
import co.ehealth.platform.visit.Visit;
import co.ehealth.platform.visit.VisitService;
import co.ehealth.platform.visit.QueueToken;
import co.ehealth.platform.visit.QueueTokenRepository;
import co.ehealth.platform.visit.TokenPriority;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Service
public class PrescriptionService {

    private final PrescriptionRepository prescriptionRepository;
    private final PrescriptionItemRepository prescriptionItemRepository;
    private final DispensingRecordRepository dispensingRecordRepository;
    private final VisitService visitService;
    private final StaffService staffService;
    private final AuditLogService auditLogService;
    private final Clock clock;
    private final PermissionService permissionService;
    private final QueueTokenRepository queueTokenRepository;

    public PrescriptionService(PrescriptionRepository prescriptionRepository,
                                PrescriptionItemRepository prescriptionItemRepository,
                                DispensingRecordRepository dispensingRecordRepository, VisitService visitService,
                                StaffService staffService, AuditLogService auditLogService, Clock clock,
                                PermissionService permissionService, QueueTokenRepository queueTokenRepository) {
        this.prescriptionRepository = prescriptionRepository;
        this.prescriptionItemRepository = prescriptionItemRepository;
        this.dispensingRecordRepository = dispensingRecordRepository;
        this.visitService = visitService;
        this.staffService = staffService;
        this.auditLogService = auditLogService;
        this.clock = clock;
        this.permissionService = permissionService;
        this.queueTokenRepository = queueTokenRepository;
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
                        PrescriptionStatus.PENDING).stream()
                .sorted((left, right) -> {
                    int priority = Integer.compare(priorityRank(right), priorityRank(left));
                    return priority != 0 ? priority : left.getCreatedAt().compareTo(right.getCreatedAt());
                })
                .toList();
    }

    public Visit getVisit(UUID visitId) {
        return visitService.get(visitId);
    }

    public QueueToken getQueueToken(UUID visitId) {
        return queueTokenRepository.findTopByVisitIdOrderByIssuedAtDesc(visitId).orElse(null);
    }

    private int priorityRank(Prescription prescription) {
        QueueToken token = getQueueToken(prescription.getVisitId());
        return token != null && token.getPriority() == TokenPriority.PRIORITY ? 1 : 0;
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

        prescription.markDispensed();
        prescriptionRepository.save(prescription);
        dispensingRecordRepository.save(new DispensingRecord(prescriptionId, dispenserId, clock.instant()));

        auditLogService.append(dispenserId, prescription.getFacilityId(), "PRESCRIPTION_DISPENSED", "Prescription",
                prescriptionId.toString(), null, null);
    }

    public record CreatePrescriptionCommand(UUID visitId, List<PrescriptionItemInput> items) {
    }

    public record PrescriptionItemInput(String drugName, String dosage, int quantity) {
    }
}
