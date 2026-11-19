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
import java.time.LocalDate;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

@Service
public class ArtInitiationTbScreeningService {
    private static final Set<String> CLINICAL_ROLES =
            Set.of("Professional Nurse", "Doctor", "Clinician", "Occupational Health Practitioner");
    private static final int MAX_TEXT_LENGTH = 10_000;

    private final ArtInitiationTbScreeningRepository repository;
    private final VisitRepository visitRepository;
    private final ConsultationRepository consultationRepository;
    private final PatientService patientService;
    private final PermissionService permissionService;
    private final AuditLogService auditLogService;
    private final Clock clock;

    public ArtInitiationTbScreeningService(ArtInitiationTbScreeningRepository repository,
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
    public Optional<ArtInitiationTbScreening> getForVisit(UUID visitId) {
        permissionService.requireAccess(ModuleCode.RECQ, PermissionLevel.VIEW);
        permissionService.requireAnyRole(CLINICAL_ROLES, "Only clinical staff may view TB screening details.");
        requireArtInitiationVisit(visitId);
        return repository.findByVisitId(visitId);
    }

    @Transactional
    public ArtInitiationTbScreening save(UUID visitId, ArtInitiationTbScreeningController.SaveRequest request,
            UUID userId) {
        permissionService.requireAccess(ModuleCode.RECQ, PermissionLevel.MANAGE);
        permissionService.requireAnyRole(CLINICAL_ROLES, "Only clinical staff may save TB screening details.");
        validate(request);
        Visit visit = requireArtInitiationVisit(visitId);
        if (visit.getPatientId() != null) {
            Patient patient = patientService.get(visit.getPatientId());
            if (patient.isArchived()) throw new PatientArchivedException();
        }

        ArtInitiationTbScreening screening = repository.findByVisitId(visitId)
                .orElseGet(() -> new ArtInitiationTbScreening(visitId, userId, clock.instant()));
        screening.update(request, userId, clock.instant());
        ArtInitiationTbScreening saved = repository.save(screening);
        auditLogService.append(userId, visit.getFacilityId(), "ART_INITIATION_TB_SCREENING_SAVED",
                "ArtInitiationTbScreening", saved.getId().toString(), null, null);
        return saved;
    }

    private void validate(ArtInitiationTbScreeningController.SaveRequest request) {
        int currentYear = LocalDate.now(clock).getYear();
        if (request.previousTbYear() != null
                && (request.previousTbYear() < 1980 || request.previousTbYear() > currentYear)) {
            throw new InvalidArtInitiationTbScreeningException(
                    "Previous TB year must be between 1980 and " + currentYear + ".");
        }
        if (request.smearDateResult() != null && request.smearDateResult().trim().length() > MAX_TEXT_LENGTH) {
            throw new InvalidArtInitiationTbScreeningException(
                    "Smear date result must be " + MAX_TEXT_LENGTH + " characters or fewer.");
        }
        if (request.clinicalIndication() != null && request.clinicalIndication().trim().length() > MAX_TEXT_LENGTH) {
            throw new InvalidArtInitiationTbScreeningException(
                    "Clinical indication must be " + MAX_TEXT_LENGTH + " characters or fewer.");
        }
    }

    private Visit requireArtInitiationVisit(UUID visitId) {
        Visit visit = visitRepository.findById(visitId).orElseThrow(VisitNotFoundException::new);
        if (visit.getServiceStream() != ServiceStream.CHRONIC_CARE) {
            throw new InvalidArtInitiationTbScreeningException(
                    "TB screening details are only available for chronic-care visits.");
        }
        Consultation consultation = consultationRepository
                .findFirstByVisitIdAndStatusOrderByCreatedAtDesc(visitId, ConsultationStatus.DRAFT)
                .or(() -> consultationRepository.findFirstByVisitIdAndStatusOrderByCreatedAtDesc(
                        visitId, ConsultationStatus.SIGNED))
                .orElseThrow(() -> new InvalidArtInitiationTbScreeningException(
                        "Start an Adult ART Initiation consultation before saving TB screening details."));
        if (consultation.getArtPathwayCode() != ArtPathwayCode.ADULT_ART_INITIATION) {
            throw new InvalidArtInitiationTbScreeningException(
                    "TB screening details are only available for Adult ART Initiation visits.");
        }
        return visit;
    }
}
