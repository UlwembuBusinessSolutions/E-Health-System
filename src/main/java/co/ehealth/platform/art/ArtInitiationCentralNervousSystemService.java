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
public class ArtInitiationCentralNervousSystemService {
    private static final Set<String> CLINICAL_ROLES =
            Set.of("Professional Nurse", "Doctor", "Clinician", "Occupational Health Practitioner");
    private static final int MAX_COMMENT_LENGTH = 10_000;

    private final ArtInitiationCentralNervousSystemRepository repository;
    private final VisitRepository visitRepository;
    private final ConsultationRepository consultationRepository;
    private final PatientService patientService;
    private final PermissionService permissionService;
    private final AuditLogService auditLogService;
    private final Clock clock;

    public ArtInitiationCentralNervousSystemService(ArtInitiationCentralNervousSystemRepository repository,
            VisitRepository visitRepository, ConsultationRepository consultationRepository,
            PatientService patientService, PermissionService permissionService,
            AuditLogService auditLogService, Clock clock) {
        this.repository = repository;
        this.visitRepository = visitRepository;
        this.consultationRepository = consultationRepository;
        this.patientService = patientService;
        this.permissionService = permissionService;
        this.auditLogService = auditLogService;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public Optional<ArtInitiationCentralNervousSystem> getForVisit(UUID visitId) {
        permissionService.requireAccess(ModuleCode.RECQ, PermissionLevel.VIEW);
        permissionService.requireAnyRole(CLINICAL_ROLES,
                "Only clinical staff may view central nervous system findings.");
        requireArtInitiationVisit(visitId);
        return repository.findByVisitId(visitId);
    }

    @Transactional
    public ArtInitiationCentralNervousSystem save(UUID visitId,
            ArtInitiationCentralNervousSystemController.SaveRequest request, UUID userId) {
        permissionService.requireAccess(ModuleCode.RECQ, PermissionLevel.MANAGE);
        permissionService.requireAnyRole(CLINICAL_ROLES,
                "Only clinical staff may save central nervous system findings.");
        validateComment(request.normalComment());
        validateComment(request.abnormalComment());
        Visit visit = requireArtInitiationVisit(visitId);
        if (visit.getPatientId() != null) {
            Patient patient = patientService.get(visit.getPatientId());
            if (patient.isArchived()) throw new PatientArchivedException();
        }

        ArtInitiationCentralNervousSystem examination = repository.findByVisitId(visitId)
                .orElseGet(() -> new ArtInitiationCentralNervousSystem(visitId, userId, clock.instant()));
        examination.update(request.finding(), request.normalComment(), request.abnormalComment(), userId, clock.instant());
        ArtInitiationCentralNervousSystem saved = repository.save(examination);
        auditLogService.append(userId, visit.getFacilityId(), "ART_INITIATION_CENTRAL_NERVOUS_SYSTEM_SAVED",
                "ArtInitiationCentralNervousSystem", saved.getId().toString(), null, null);
        return saved;
    }

    private static void validateComment(String comment) {
        if (comment != null && comment.trim().length() > MAX_COMMENT_LENGTH) {
            throw new InvalidArtInitiationCentralNervousSystemException(
                    "Comments must be " + MAX_COMMENT_LENGTH + " characters or fewer.");
        }
    }

    private Visit requireArtInitiationVisit(UUID visitId) {
        Visit visit = visitRepository.findById(visitId).orElseThrow(VisitNotFoundException::new);
        if (visit.getServiceStream() != ServiceStream.CHRONIC_CARE) {
            throw new InvalidArtInitiationCentralNervousSystemException(
                    "Central nervous system findings are only available for chronic-care visits.");
        }
        Consultation consultation = consultationRepository
                .findFirstByVisitIdAndStatusOrderByCreatedAtDesc(visitId, ConsultationStatus.DRAFT)
                .or(() -> consultationRepository.findFirstByVisitIdAndStatusOrderByCreatedAtDesc(
                        visitId, ConsultationStatus.SIGNED))
                .orElseThrow(() -> new InvalidArtInitiationCentralNervousSystemException(
                        "Start an Adult ART Initiation consultation before saving central nervous system findings."));
        if (consultation.getArtPathwayCode() != ArtPathwayCode.ADULT_ART_INITIATION) {
            throw new InvalidArtInitiationCentralNervousSystemException(
                    "Central nervous system findings are only available for Adult ART Initiation visits.");
        }
        return visit;
    }
}
