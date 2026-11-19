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
public class ArtInitiationSummaryService {

    private static final Set<String> CLINICAL_ROLES =
            Set.of("Professional Nurse", "Doctor", "Clinician", "Occupational Health Practitioner");
    private static final int MIN_HIV_DIAGNOSIS_YEAR = 1980;
    private static final int MAX_DETAILS_LENGTH = 10_000;

    private final ArtInitiationSummaryRepository summaryRepository;
    private final VisitRepository visitRepository;
    private final ConsultationRepository consultationRepository;
    private final PatientService patientService;
    private final PermissionService permissionService;
    private final AuditLogService auditLogService;
    private final Clock clock;

    public ArtInitiationSummaryService(ArtInitiationSummaryRepository summaryRepository,
            VisitRepository visitRepository, ConsultationRepository consultationRepository,
            PatientService patientService, PermissionService permissionService,
            AuditLogService auditLogService, Clock clock) {
        this.summaryRepository = summaryRepository;
        this.visitRepository = visitRepository;
        this.consultationRepository = consultationRepository;
        this.patientService = patientService;
        this.permissionService = permissionService;
        this.auditLogService = auditLogService;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public Optional<ArtInitiationSummary> getForVisit(UUID visitId) {
        requireReadAccess();
        requireArtInitiationVisit(visitId);
        return summaryRepository.findByVisitId(visitId);
    }

    @Transactional
    public ArtInitiationSummary save(UUID visitId, SaveArtInitiationSummaryCommand command, UUID staffUserId) {
        permissionService.requireAccess(ModuleCode.RECQ, PermissionLevel.MANAGE);
        permissionService.requireAnyRole(CLINICAL_ROLES, "Only clinical staff may save ART initiation summaries.");

        if (command.hivDiagnosisYear() != null) {
            int currentYear = LocalDate.now(clock).getYear();
            if (command.hivDiagnosisYear() < MIN_HIV_DIAGNOSIS_YEAR
                    || command.hivDiagnosisYear() > currentYear) {
                throw new InvalidArtInitiationSummaryException(
                        "HIV diagnosis year must be between " + MIN_HIV_DIAGNOSIS_YEAR + " and " + currentYear + ".");
            }
        }
        if (command.details() != null && command.details().trim().length() > MAX_DETAILS_LENGTH) {
            throw new InvalidArtInitiationSummaryException(
                    "Details must be " + MAX_DETAILS_LENGTH + " characters or fewer.");
        }

        Visit visit = requireArtInitiationVisit(visitId);
        if (visit.getPatientId() != null) {
            Patient patient = patientService.get(visit.getPatientId());
            if (patient.isArchived()) {
                throw new PatientArchivedException();
            }
        }

        ArtInitiationSummary summary = summaryRepository.findByVisitId(visitId)
                .orElseGet(() -> new ArtInitiationSummary(visitId, null, null, null, null, staffUserId, clock.instant()));
        summary.update(command.artStartDate(), command.hivDiagnosisYear(), command.priorTherapy(),
                normalize(command.details()), staffUserId, clock.instant());
        ArtInitiationSummary saved = summaryRepository.save(summary);
        auditLogService.append(staffUserId, visit.getFacilityId(), "ART_INITIATION_SUMMARY_SAVED",
                "ArtInitiationSummary", saved.getId().toString(), null, null);
        return saved;
    }

    private void requireReadAccess() {
        permissionService.requireAccess(ModuleCode.RECQ, PermissionLevel.VIEW);
        permissionService.requireAnyRole(CLINICAL_ROLES, "Only clinical staff may view ART initiation summaries.");
    }

    private Visit requireArtInitiationVisit(UUID visitId) {
        Visit visit = visitRepository.findById(visitId).orElseThrow(VisitNotFoundException::new);
        if (visit.getServiceStream() != ServiceStream.CHRONIC_CARE) {
            throw new InvalidArtInitiationSummaryException(
                    "ART initiation summaries are only available for chronic-care visits.");
        }

        Consultation consultation = consultationRepository
                .findFirstByVisitIdAndStatusOrderByCreatedAtDesc(visitId, ConsultationStatus.DRAFT)
                .or(() -> consultationRepository.findFirstByVisitIdAndStatusOrderByCreatedAtDesc(
                        visitId, ConsultationStatus.SIGNED))
                .orElseThrow(() -> new InvalidArtInitiationSummaryException(
                        "Start an Adult ART Initiation consultation before saving its summary."));
        if (consultation.getArtPathwayCode() != ArtPathwayCode.ADULT_ART_INITIATION) {
            throw new InvalidArtInitiationSummaryException(
                    "ART summary details are only available for Adult ART Initiation visits.");
        }
        return visit;
    }

    private static String normalize(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    public record SaveArtInitiationSummaryCommand(LocalDate artStartDate, Integer hivDiagnosisYear,
            ArtPriorTherapy priorTherapy, String details) {
    }
}
