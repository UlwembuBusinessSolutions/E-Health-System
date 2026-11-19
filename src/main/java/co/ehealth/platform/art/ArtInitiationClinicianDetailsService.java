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
import org.springframework.util.StringUtils;

import java.time.Clock;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

@Service
public class ArtInitiationClinicianDetailsService {
    private static final Set<String> CLINICAL_ROLES =
            Set.of("Professional Nurse", "Doctor", "Clinician", "Occupational Health Practitioner");
    private static final String PNG_DATA_URL_PREFIX = "data:image/png;base64,";
    private static final int MAX_SIGNATURE_CHARACTERS = 200_000;
    private static final int MAX_QUALIFICATIONS_LENGTH = 10_000;

    private final ArtInitiationClinicianDetailsRepository repository;
    private final VisitRepository visitRepository;
    private final ConsultationRepository consultationRepository;
    private final PatientService patientService;
    private final PermissionService permissionService;
    private final AuditLogService auditLogService;
    private final Clock clock;

    public ArtInitiationClinicianDetailsService(ArtInitiationClinicianDetailsRepository repository,
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
    public Optional<ArtInitiationClinicianDetails> getForVisit(UUID visitId) {
        permissionService.requireAccess(ModuleCode.RECQ, PermissionLevel.VIEW);
        permissionService.requireAnyRole(CLINICAL_ROLES, "Only clinical staff may view clinician details.");
        requireArtInitiationVisit(visitId);
        return repository.findByVisitId(visitId);
    }

    @Transactional
    public ArtInitiationClinicianDetails save(UUID visitId,
            ArtInitiationClinicianDetailsController.SaveRequest request, UUID userId) {
        permissionService.requireAccess(ModuleCode.RECQ, PermissionLevel.MANAGE);
        permissionService.requireAnyRole(CLINICAL_ROLES, "Only clinical staff may save clinician details.");
        validate(request);
        Visit visit = requireArtInitiationVisit(visitId);
        if (visit.getPatientId() != null) {
            Patient patient = patientService.get(visit.getPatientId());
            if (patient.isArchived()) throw new PatientArchivedException();
        }
        ArtInitiationClinicianDetails details = repository.findByVisitId(visitId)
                .orElseGet(() -> new ArtInitiationClinicianDetails(visitId, userId, clock.instant()));
        details.update(request, userId, clock.instant());
        ArtInitiationClinicianDetails saved = repository.save(details);
        auditLogService.append(userId, visit.getFacilityId(), "ART_INITIATION_CLINICIAN_DETAILS_SAVED",
                "ArtInitiationClinicianDetails", saved.getId().toString(), null, null);
        return saved;
    }

    private static void validate(ArtInitiationClinicianDetailsController.SaveRequest request) {
        if (request.clinicianName() != null && request.clinicianName().trim().length() > 200) {
            throw new InvalidArtInitiationClinicianDetailsException("Clinician name must be 200 characters or fewer.");
        }
        if (request.clinicianQualifications() != null
                && request.clinicianQualifications().trim().length() > MAX_QUALIFICATIONS_LENGTH) {
            throw new InvalidArtInitiationClinicianDetailsException(
                    "Qualifications must be " + MAX_QUALIFICATIONS_LENGTH + " characters or fewer.");
        }
        if (request.sancNumber() != null && request.sancNumber().trim().length() > 30
                || request.hpcsaNumber() != null && request.hpcsaNumber().trim().length() > 30) {
            throw new InvalidArtInitiationClinicianDetailsException("Registration numbers must be 30 characters or fewer.");
        }
        String signature = request.signatureDataUrl();
        if (StringUtils.hasText(signature)
                && (!signature.startsWith(PNG_DATA_URL_PREFIX) || signature.length() > MAX_SIGNATURE_CHARACTERS)) {
            throw new InvalidArtInitiationClinicianDetailsException(
                    "The signature must be a PNG image no larger than 200,000 characters.");
        }
    }

    private Visit requireArtInitiationVisit(UUID visitId) {
        Visit visit = visitRepository.findById(visitId).orElseThrow(VisitNotFoundException::new);
        if (visit.getServiceStream() != ServiceStream.CHRONIC_CARE) {
            throw new InvalidArtInitiationClinicianDetailsException(
                    "Clinician details are only available for chronic-care visits.");
        }
        Consultation consultation = consultationRepository
                .findFirstByVisitIdAndStatusOrderByCreatedAtDesc(visitId, ConsultationStatus.DRAFT)
                .or(() -> consultationRepository.findFirstByVisitIdAndStatusOrderByCreatedAtDesc(
                        visitId, ConsultationStatus.SIGNED))
                .orElseThrow(() -> new InvalidArtInitiationClinicianDetailsException(
                        "Start an Adult ART Initiation consultation before saving clinician details."));
        if (consultation.getArtPathwayCode() != ArtPathwayCode.ADULT_ART_INITIATION) {
            throw new InvalidArtInitiationClinicianDetailsException(
                    "Clinician details are only available for Adult ART Initiation visits.");
        }
        return visit;
    }
}
