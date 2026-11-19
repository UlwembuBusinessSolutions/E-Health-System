package co.ehealth.platform.art;

import co.ehealth.platform.consultation.ArtPathwayCode;
import co.ehealth.platform.consultation.Consultation;
import co.ehealth.platform.consultation.ConsultationRepository;
import co.ehealth.platform.consultation.ConsultationStatus;
import co.ehealth.platform.core.audit.AuditLogService;
import co.ehealth.platform.core.tenant.ModuleCode;
import co.ehealth.platform.identity.PermissionLevel;
import co.ehealth.platform.identity.PermissionService;
import co.ehealth.platform.patient.Patient;
import co.ehealth.platform.patient.PatientArchivedException;
import co.ehealth.platform.patient.PatientService;
import co.ehealth.platform.visit.ServiceStream;
import co.ehealth.platform.visit.Visit;
import co.ehealth.platform.visit.VisitNotFoundException;
import co.ehealth.platform.visit.VisitRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.Clock;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

@Service
public class ArtStage1ConditionsService {
    private static final Set<String> CLINICAL_ROLES = Set.of("Professional Nurse", "Doctor", "Clinician", "Occupational Health Practitioner");
    private final ArtStage1ConditionsRepository repository;
    private final VisitRepository visitRepository;
    private final ConsultationRepository consultationRepository;
    private final PatientService patientService;
    private final PermissionService permissionService;
    private final AuditLogService auditLogService;
    private final Clock clock;

    public ArtStage1ConditionsService(ArtStage1ConditionsRepository repository, VisitRepository visitRepository,
            ConsultationRepository consultationRepository, PatientService patientService,
            PermissionService permissionService, AuditLogService auditLogService, Clock clock) {
        this.repository = repository; this.visitRepository = visitRepository; this.consultationRepository = consultationRepository;
        this.patientService = patientService; this.permissionService = permissionService; this.auditLogService = auditLogService; this.clock = clock;
    }

    @Transactional(readOnly = true)
    public Optional<ArtStage1Conditions> getForVisit(UUID visitId) {
        permissionService.requireAccess(ModuleCode.RECQ, PermissionLevel.VIEW);
        permissionService.requireAnyRole(CLINICAL_ROLES, "Only clinical staff may view Stage 1 conditions.");
        requireArtInitiationVisit(visitId);
        return repository.findByVisitId(visitId);
    }

    @Transactional
    public ArtStage1Conditions save(UUID visitId, ArtStage1ConditionsController.SaveRequest request, UUID userId) {
        permissionService.requireAccess(ModuleCode.RECQ, PermissionLevel.MANAGE);
        permissionService.requireAnyRole(CLINICAL_ROLES, "Only clinical staff may save Stage 1 conditions.");
        for (String text : new String[] { request.stage1OtherSpecify(), request.stage2OtherSpecify(), request.stage3OtherSpecify(), request.cd4Result() }) {
            if (text != null && text.trim().length() > 10_000) throw new InvalidArtStage1ConditionsException("Text fields must be 10,000 characters or fewer.");
        }
        Visit visit = requireArtInitiationVisit(visitId);
        if (visit.getPatientId() != null && patientService.get(visit.getPatientId()).isArchived()) throw new PatientArchivedException();
        ArtStage1Conditions details = repository.findByVisitId(visitId).orElseGet(() -> new ArtStage1Conditions(visitId, userId, clock.instant()));
        details.update(request, userId, clock.instant());
        ArtStage1Conditions saved = repository.save(details);
        auditLogService.append(userId, visit.getFacilityId(), "ART_STAGE_1_CONDITIONS_SAVED", "ArtStage1Conditions", saved.getId().toString(), null, null);
        return saved;
    }

    private Visit requireArtInitiationVisit(UUID visitId) {
        Visit visit = visitRepository.findById(visitId).orElseThrow(VisitNotFoundException::new);
        if (visit.getServiceStream() != ServiceStream.CHRONIC_CARE) throw new InvalidArtStage1ConditionsException("Stage 1 conditions are only available for chronic-care visits.");
        Consultation consultation = consultationRepository.findFirstByVisitIdAndStatusOrderByCreatedAtDesc(visitId, ConsultationStatus.DRAFT)
                .or(() -> consultationRepository.findFirstByVisitIdAndStatusOrderByCreatedAtDesc(visitId, ConsultationStatus.SIGNED))
                .orElseThrow(() -> new InvalidArtStage1ConditionsException("Start an Adult ART Initiation consultation before saving Stage 1 conditions."));
        if (consultation.getArtPathwayCode() != ArtPathwayCode.ADULT_ART_INITIATION) throw new InvalidArtStage1ConditionsException("Stage 1 conditions are only available for Adult ART Initiation visits.");
        return visit;
    }
}
