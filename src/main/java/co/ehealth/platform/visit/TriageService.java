package co.ehealth.platform.visit;

import co.ehealth.platform.core.audit.AuditLogService;
import co.ehealth.platform.core.tenant.ModuleCode;
import co.ehealth.platform.identity.PermissionLevel;
import co.ehealth.platform.identity.PermissionService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.util.UUID;

@Service
public class TriageService {
    private final VisitRepository visitRepository;
    private final TriageAssessmentRepository assessmentRepository;
    private final QueueTokenRepository queueTokenRepository;
    private final AuditLogService auditLogService;
    private final PermissionService permissionService;
    private final Clock clock;

    public TriageService(VisitRepository visitRepository, TriageAssessmentRepository assessmentRepository,
                         QueueTokenRepository queueTokenRepository, AuditLogService auditLogService,
                         PermissionService permissionService, Clock clock) {
        this.visitRepository = visitRepository;
        this.assessmentRepository = assessmentRepository;
        this.queueTokenRepository = queueTokenRepository;
        this.auditLogService = auditLogService;
        this.permissionService = permissionService;
        this.clock = clock;
    }

    @Transactional
    public TriageAssessment record(UUID visitId, TriageVitals vitals, TriageColour override,
                                   String overrideReason, UUID userId) {
        permissionService.requireAccess(ModuleCode.RECQ, PermissionLevel.MANAGE);
        Visit visit = visitRepository.findById(visitId).orElseThrow(VisitNotFoundException::new);
        if (override != null && (overrideReason == null || overrideReason.isBlank())) {
            throw new IllegalArgumentException("An override reason is required.");
        }
        int score = TewsCalculator.score(vitals);
        TriageColour calculated = TewsCalculator.colour(vitals, score);
        TriageColour assigned = override == null ? calculated : override;
        TriageAssessment assessment = new TriageAssessment(visitId, vitals, score, calculated, assigned,
                overrideReason, userId, clock.instant());
        assessmentRepository.save(assessment);
        queueTokenRepository.findTopByVisitIdOrderByIssuedAtDesc(visitId).ifPresent(token -> {
            if (assigned == TriageColour.RED || assigned == TriageColour.ORANGE) token.promote();
            queueTokenRepository.save(token);
        });
        auditLogService.append(userId, visit.getFacilityId(),
                override == null ? "TEWS_CALCULATED" : "TRIAGE_COLOUR_OVERRIDDEN",
                "TriageAssessment", assessment.getId().toString(), null,
                "{\"tewsScore\":" + score + ",\"calculatedColour\":\"" + calculated
                        + "\",\"assignedColour\":\"" + assigned + "\"}");
        return assessment;
    }
}
