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
public class ArtInitiationJaccolExaminationService {
    private static final Set<String> CLINICAL_ROLES =
            Set.of("Professional Nurse", "Doctor", "Clinician", "Occupational Health Practitioner");
    private static final int MAX_TEXT_LENGTH = 10_000;

    private final ArtInitiationJaccolExaminationRepository repository;
    private final VisitRepository visitRepository;
    private final ConsultationRepository consultationRepository;
    private final PatientService patientService;
    private final PermissionService permissionService;
    private final AuditLogService auditLogService;
    private final Clock clock;

    public ArtInitiationJaccolExaminationService(ArtInitiationJaccolExaminationRepository repository,
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
    public Optional<ArtInitiationJaccolExamination> getForVisit(UUID visitId) {
        permissionService.requireAccess(ModuleCode.RECQ, PermissionLevel.VIEW);
        permissionService.requireAnyRole(CLINICAL_ROLES, "Only clinical staff may view JACCOL examination details.");
        requireArtInitiationVisit(visitId);
        return repository.findByVisitId(visitId);
    }

    @Transactional
    public ArtInitiationJaccolExamination save(UUID visitId,
            ArtInitiationJaccolExaminationController.SaveRequest request, UUID userId) {
        permissionService.requireAccess(ModuleCode.RECQ, PermissionLevel.MANAGE);
        permissionService.requireAnyRole(CLINICAL_ROLES, "Only clinical staff may save JACCOL examination details.");
        validateTextLengths(request);
        Visit visit = requireArtInitiationVisit(visitId);
        if (visit.getPatientId() != null) {
            Patient patient = patientService.get(visit.getPatientId());
            if (patient.isArchived()) throw new PatientArchivedException();
        }

        ArtInitiationJaccolExamination examination = repository.findByVisitId(visitId)
                .orElseGet(() -> new ArtInitiationJaccolExamination(visitId, userId, clock.instant()));
        examination.update(request, userId, clock.instant());
        ArtInitiationJaccolExamination saved = repository.save(examination);
        auditLogService.append(userId, visit.getFacilityId(), "ART_INITIATION_JACCOL_EXAMINATION_SAVED",
                "ArtInitiationJaccolExamination", saved.getId().toString(), null, null);
        return saved;
    }

    private static void validateTextLengths(ArtInitiationJaccolExaminationController.SaveRequest request) {
        String[] textValues = { request.jComment(), request.aComment(), request.c1Comment(), request.c2Comment(),
                request.oComment(), request.lComment(), request.otherComment(), request.notes() };
        for (String value : textValues) {
            if (value != null && value.trim().length() > MAX_TEXT_LENGTH) {
                throw new InvalidArtInitiationJaccolExaminationException(
                        "Comment and notes fields must be " + MAX_TEXT_LENGTH + " characters or fewer.");
            }
        }
    }

    private Visit requireArtInitiationVisit(UUID visitId) {
        Visit visit = visitRepository.findById(visitId).orElseThrow(VisitNotFoundException::new);
        if (visit.getServiceStream() != ServiceStream.CHRONIC_CARE) {
            throw new InvalidArtInitiationJaccolExaminationException(
                    "JACCOL examination details are only available for chronic-care visits.");
        }
        Consultation consultation = consultationRepository
                .findFirstByVisitIdAndStatusOrderByCreatedAtDesc(visitId, ConsultationStatus.DRAFT)
                .or(() -> consultationRepository.findFirstByVisitIdAndStatusOrderByCreatedAtDesc(
                        visitId, ConsultationStatus.SIGNED))
                .orElseThrow(() -> new InvalidArtInitiationJaccolExaminationException(
                        "Start an Adult ART Initiation consultation before saving JACCOL examination details."));
        if (consultation.getArtPathwayCode() != ArtPathwayCode.ADULT_ART_INITIATION) {
            throw new InvalidArtInitiationJaccolExaminationException(
                    "JACCOL examination details are only available for Adult ART Initiation visits.");
        }
        return visit;
    }
}
