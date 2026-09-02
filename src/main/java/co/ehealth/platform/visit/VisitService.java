package co.ehealth.platform.visit;

import co.ehealth.platform.core.audit.AuditLogService;
import co.ehealth.platform.core.tenant.ModuleCode;
import co.ehealth.platform.facility.FacilityService;
import co.ehealth.platform.identity.PermissionLevel;
import co.ehealth.platform.identity.PermissionService;
import co.ehealth.platform.patient.Patient;
import co.ehealth.platform.patient.PatientArchivedException;
import co.ehealth.platform.patient.PatientService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.util.UUID;

@Service
public class VisitService {

    private final VisitRepository visitRepository;
    private final PatientService patientService;
    private final FacilityService facilityService;
    private final QueueService queueService;
    private final AuditLogService auditLogService;
    private final Clock clock;
    private final PermissionService permissionService;

    public VisitService(VisitRepository visitRepository, PatientService patientService,
            FacilityService facilityService, QueueService queueService,
            AuditLogService auditLogService, Clock clock, PermissionService permissionService) {
        this.visitRepository = visitRepository;
        this.patientService = patientService;
        this.facilityService = facilityService;
        this.queueService = queueService;
        this.auditLogService = auditLogService;
        this.clock = clock;
        this.permissionService = permissionService;
    }

    // PREG-US-019 + RECQ-US-001 in one atomic call — "Visit w/ valid MPI ->
    // token issued" reads as a single hand-off, not create-visit-then-
    // separately-remember-to-issue-a-token. patientService.get()/
    // facilityService.get() are the "no valid MPI -> blocked" and facility-
    // existence guards; both throw their own NotFoundException before any
    // row is written if either id is wrong, per the module-boundary rule
    // (StaffService/OrganizationProvisioningService's own precedent) —
    // visit never touches PatientRepository or FacilityRepository directly.
    @Transactional
    public VisitWithToken createVisit(CreateVisitCommand cmd, UUID staffUserId) {
        permissionService.requireAccess(ModuleCode.RECQ, PermissionLevel.MANAGE);
        patientService.get(cmd.patientId());

        Patient patient = patientService.get(cmd.patientId());
        if (patient.isDeceased()) {
            throw new PatientArchivedException();
        }

        facilityService.get(cmd.facilityId());

        facilityService.get(cmd.facilityId());

        Visit visit = new Visit(cmd.patientId(), cmd.facilityId(), cmd.visitType(), cmd.serviceStream(),
                clock.instant(), staffUserId);
        visitRepository.save(visit);

        QueueToken token = queueService.issueAutomaticToken(visit, staffUserId);

        auditLogService.append(staffUserId, cmd.facilityId(), "VISIT_CREATED", "Visit", visit.getId().toString(),
                null, null);

        return new VisitWithToken(visit, token);
    }

    public Visit get(UUID id) {
        permissionService.requireAccess(ModuleCode.RECQ, PermissionLevel.VIEW);
        return visitRepository.findById(id).orElseThrow(VisitNotFoundException::new);
    }

    public record CreateVisitCommand(UUID patientId, UUID facilityId, VisitType visitType,
            ServiceStream serviceStream) {
    }

    public record VisitWithToken(Visit visit, QueueToken token) {
    }
}
