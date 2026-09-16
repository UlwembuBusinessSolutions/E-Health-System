package co.ehealth.platform.visit;

import co.ehealth.platform.core.audit.AuditLogService;
import co.ehealth.platform.core.tenant.ModuleCode;
import co.ehealth.platform.facility.Facility;
import co.ehealth.platform.facility.FacilityRepository;
import co.ehealth.platform.facility.FacilityService;
import co.ehealth.platform.identity.PermissionLevel;
import co.ehealth.platform.identity.PermissionService;
import co.ehealth.platform.patient.PatientService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class VisitService {

    private final VisitRepository visitRepository;
    private final PatientService patientService;
    private final FacilityService facilityService;
    private final FacilityRepository facilityRepository;
    private final QueueService queueService;
    private final AuditLogService auditLogService;
    private final Clock clock;
    private final PermissionService permissionService;

    public VisitService(VisitRepository visitRepository, PatientService patientService,
                         FacilityService facilityService, FacilityRepository facilityRepository,
                         QueueService queueService, AuditLogService auditLogService, Clock clock,
                         PermissionService permissionService) {
        this.visitRepository = visitRepository;
        this.patientService = patientService;
        this.facilityService = facilityService;
        this.facilityRepository = facilityRepository;
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

    // The patient record's own Visits tab — every visit this patient has
    // ever had, across every facility, newest first. Resolves each one's
    // facility name via a single batch lookup rather than facilityService.get()
    // per row — same "batch-resolve, don't N+1" shape TriageService.
    // resolveCapturedByNames() already uses for captured-by names, and the
    // same reasoning: a module boundary crossed via a directly-injected
    // repository (not a second service call) for a read-only enrichment,
    // already precedented by this exact service's facilityZone()-equivalent
    // callers elsewhere in this codebase.
    public List<PatientVisitView> getPatientVisitHistory(UUID patientId) {
        permissionService.requireAccess(ModuleCode.RECQ, PermissionLevel.VIEW);
        List<Visit> visits = visitRepository.findByPatientIdOrderByVisitDateTimeDesc(patientId);
        Set<UUID> facilityIds = visits.stream().map(Visit::getFacilityId).collect(Collectors.toSet());
        Map<UUID, String> facilityNames = facilityRepository.findAllById(facilityIds).stream()
                .collect(Collectors.toMap(Facility::getId, Facility::getName));
        return visits.stream()
                .map(v -> new PatientVisitView(v, facilityNames.get(v.getFacilityId())))
                .toList();
    }

    public record CreateVisitCommand(UUID patientId, UUID facilityId, VisitType visitType,
                                      ServiceStream serviceStream) {
    }

    public record VisitWithToken(Visit visit, QueueToken token) {
    }

    public record PatientVisitView(Visit visit, String facilityName) {
    }
}
