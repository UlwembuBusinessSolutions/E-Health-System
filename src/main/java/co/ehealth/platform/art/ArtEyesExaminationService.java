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
public class ArtEyesExaminationService {

    private static final Set<String> CLINICAL_ROLES =
            Set.of("Professional Nurse", "Doctor", "Clinician", "Occupational Health Practitioner");
    private static final int MAX_COMMENTS_LENGTH = 10_000;

    private final ArtEyesExaminationRepository examinationRepository;
    private final VisitRepository visitRepository;
    private final ConsultationRepository consultationRepository;
    private final PatientService patientService;
    private final PermissionService permissionService;
    private final AuditLogService auditLogService;
    private final Clock clock;

    public ArtEyesExaminationService(ArtEyesExaminationRepository examinationRepository,
            VisitRepository visitRepository, ConsultationRepository consultationRepository,
            PatientService patientService, PermissionService permissionService,
            AuditLogService auditLogService, Clock clock) {
        this.examinationRepository = examinationRepository;
        this.visitRepository = visitRepository;
        this.consultationRepository = consultationRepository;
        this.patientService = patientService;
        this.permissionService = permissionService;
        this.auditLogService = auditLogService;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public Optional<ArtEyesExamination> getForVisit(UUID visitId) {
        requireReadAccess();
        requireArtInitiationVisit(visitId);
        return examinationRepository.findByVisitId(visitId);
    }

    @Transactional
    public ArtEyesExamination save(UUID visitId, EyeExaminationResult result, String comments, UUID staffUserId) {
        permissionService.requireAccess(ModuleCode.RECQ, PermissionLevel.MANAGE);
        permissionService.requireAnyRole(CLINICAL_ROLES, "Only clinical staff may save an eyes examination.");
        if (result == null) {
            throw new InvalidArtEyesExaminationException("Select Normal or Abnormal before saving.");
        }
        if (comments != null && comments.trim().length() > MAX_COMMENTS_LENGTH) {
            throw new InvalidArtEyesExaminationException(
                    "Comments must be " + MAX_COMMENTS_LENGTH + " characters or fewer.");
        }

        Visit visit = requireArtInitiationVisit(visitId);
        if (visit.getPatientId() != null) {
            Patient patient = patientService.get(visit.getPatientId());
            if (patient.isArchived()) {
                throw new PatientArchivedException();
            }
        }

        ArtEyesExamination examination = examinationRepository.findByVisitId(visitId)
                .orElseGet(() -> new ArtEyesExamination(
                        visitId, result, normalize(comments), staffUserId, clock.instant()));
        examination.update(result, normalize(comments), staffUserId, clock.instant());
        ArtEyesExamination saved = examinationRepository.save(examination);
        auditLogService.append(staffUserId, visit.getFacilityId(), "ART_EYES_EXAMINATION_SAVED",
                "ArtEyesExamination", saved.getId().toString(), null, null);
        return saved;
    }

    private void requireReadAccess() {
        permissionService.requireAccess(ModuleCode.RECQ, PermissionLevel.VIEW);
        permissionService.requireAnyRole(CLINICAL_ROLES, "Only clinical staff may view an eyes examination.");
    }

    private static String normalize(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private Visit requireArtInitiationVisit(UUID visitId) {
        Visit visit = visitRepository.findById(visitId).orElseThrow(VisitNotFoundException::new);
        if (visit.getServiceStream() != ServiceStream.CHRONIC_CARE) {
            throw new InvalidArtEyesExaminationException(
                    "Eyes examinations are only available for chronic-care visits.");
        }

        Consultation consultation = consultationRepository
                .findFirstByVisitIdAndStatusOrderByCreatedAtDesc(visitId, ConsultationStatus.DRAFT)
                .or(() -> consultationRepository.findFirstByVisitIdAndStatusOrderByCreatedAtDesc(
                        visitId, ConsultationStatus.SIGNED))
                .orElseThrow(() -> new InvalidArtEyesExaminationException(
                        "Start an Adult ART Initiation consultation before saving an eyes examination."));
        if (consultation.getArtPathwayCode() != ArtPathwayCode.ADULT_ART_INITIATION) {
            throw new InvalidArtEyesExaminationException(
                    "Eyes examinations are only available for Adult ART Initiation visits.");
        }
        return visit;
    }
}
