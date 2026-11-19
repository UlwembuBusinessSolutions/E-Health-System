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
public class ArtReproductiveHealthDetailsService {

    private static final Set<String> CLINICAL_ROLES =
            Set.of("Professional Nurse", "Doctor", "Clinician", "Occupational Health Practitioner");
    private static final int MAX_FIELD_LENGTH = 10_000;

    private final ArtReproductiveHealthDetailsRepository detailsRepository;
    private final VisitRepository visitRepository;
    private final ConsultationRepository consultationRepository;
    private final PatientService patientService;
    private final PermissionService permissionService;
    private final AuditLogService auditLogService;
    private final Clock clock;

    public ArtReproductiveHealthDetailsService(ArtReproductiveHealthDetailsRepository detailsRepository,
            VisitRepository visitRepository, ConsultationRepository consultationRepository,
            PatientService patientService, PermissionService permissionService,
            AuditLogService auditLogService, Clock clock) {
        this.detailsRepository = detailsRepository;
        this.visitRepository = visitRepository;
        this.consultationRepository = consultationRepository;
        this.patientService = patientService;
        this.permissionService = permissionService;
        this.auditLogService = auditLogService;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public Optional<ArtReproductiveHealthDetails> getForVisit(UUID visitId) {
        requireReadAccess();
        requireArtInitiationVisit(visitId);
        return detailsRepository.findByVisitId(visitId);
    }

    @Transactional
    public ArtReproductiveHealthDetails save(UUID visitId, SaveArtReproductiveHealthDetailsCommand command,
            UUID staffUserId) {
        permissionService.requireAccess(ModuleCode.RECQ, PermissionLevel.MANAGE);
        permissionService.requireAnyRole(CLINICAL_ROLES, "Only clinical staff may save reproductive health details.");

        validate(command);

        Visit visit = requireArtInitiationVisit(visitId);
        if (visit.getPatientId() != null) {
            Patient patient = patientService.get(visit.getPatientId());
            if (patient.isArchived()) {
                throw new PatientArchivedException();
            }
        }

        ArtReproductiveHealthDetails details = detailsRepository.findByVisitId(visitId)
                .orElseGet(() -> new ArtReproductiveHealthDetails(visitId, staffUserId, clock.instant()));

        details.update(
                command.pregnant(),
                command.trimester(),
                normalize(command.gravida()),
                normalize(command.para()),
                command.contraceptionMethod(),
                normalize(command.contraceptionOtherSpecify()),
                command.urethralDischarge(),
                normalize(command.urethralDischargeComment()),
                command.vaginalDischarge(),
                normalize(command.vaginalDischargeComment()),
                command.genitalUlcers(),
                normalize(command.genitalUlcersComment()),
                command.genitalWarts(),
                normalize(command.genitalWartsComment()),
                command.lowerAbdominalPain(),
                normalize(command.lowerAbdominalPainComment()),
                normalize(command.papSmearResult()),
                command.papSmearDate(),
                command.rprDate(),
                normalize(command.results()),
                normalize(command.specifyTreatmentCompleted()),
                staffUserId,
                clock.instant());

        ArtReproductiveHealthDetails saved = detailsRepository.save(details);
        auditLogService.append(staffUserId, visit.getFacilityId(), "ART_REPRODUCTIVE_HEALTH_DETAILS_SAVED",
                "ArtReproductiveHealthDetails", saved.getId().toString(), null, null);
        return saved;
    }

    private void validate(SaveArtReproductiveHealthDetailsCommand command) {
        if (command.trimester() != null && (command.trimester() < 1 || command.trimester() > 3)) {
            throw new InvalidArtReproductiveHealthDetailsException("Trimester must be between 1 and 3.");
        }
        if (Boolean.TRUE.equals(command.pregnant())) {
            if (command.trimester() == null) {
                throw new InvalidArtReproductiveHealthDetailsException("Select the trimester for a confirmed pregnancy.");
            }
            if (isBlank(command.gravida())) {
                throw new InvalidArtReproductiveHealthDetailsException("Gravida is required when the patient is pregnant.");
            }
            if (isBlank(command.para())) {
                throw new InvalidArtReproductiveHealthDetailsException("Para is required when the patient is pregnant.");
            }
        }
        if (command.contraceptionMethod() == ContraceptionMethod.OTHER && isBlank(command.contraceptionOtherSpecify())) {
            throw new InvalidArtReproductiveHealthDetailsException("Specify the other contraception method.");
        }

        validateOptionalText("Gravida", command.gravida());
        validateOptionalText("Para", command.para());
        validateOptionalText("Contraception details", command.contraceptionOtherSpecify());
        validateOptionalText("Urethral discharge comment", command.urethralDischargeComment());
        validateOptionalText("Vaginal discharge comment", command.vaginalDischargeComment());
        validateOptionalText("Genital ulcer comment", command.genitalUlcersComment());
        validateOptionalText("Genital wart comment", command.genitalWartsComment());
        validateOptionalText("Lower abdominal pain comment", command.lowerAbdominalPainComment());
        validateOptionalText("Pap smear result", command.papSmearResult());
        validateOptionalText("Results", command.results());
        validateOptionalText("Specify treatment completed", command.specifyTreatmentCompleted());
    }

    private void validateOptionalText(String fieldName, String value) {
        if (value != null && value.trim().length() > MAX_FIELD_LENGTH) {
            throw new InvalidArtReproductiveHealthDetailsException(
                    fieldName + " must be " + MAX_FIELD_LENGTH + " characters or fewer.");
        }
    }

    private void requireReadAccess() {
        permissionService.requireAccess(ModuleCode.RECQ, PermissionLevel.VIEW);
        permissionService.requireAnyRole(CLINICAL_ROLES, "Only clinical staff may view reproductive health details.");
    }

    private static String normalize(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private static boolean isBlank(String value) {
        return value == null || value.isBlank();
    }

    private Visit requireArtInitiationVisit(UUID visitId) {
        Visit visit = visitRepository.findById(visitId).orElseThrow(VisitNotFoundException::new);
        if (visit.getServiceStream() != ServiceStream.CHRONIC_CARE) {
            throw new InvalidArtReproductiveHealthDetailsException(
                    "Reproductive health details are only available for chronic-care visits.");
        }

        Consultation consultation = consultationRepository
                .findFirstByVisitIdAndStatusOrderByCreatedAtDesc(visitId, ConsultationStatus.DRAFT)
                .or(() -> consultationRepository.findFirstByVisitIdAndStatusOrderByCreatedAtDesc(
                        visitId, ConsultationStatus.SIGNED))
                .orElseThrow(() -> new InvalidArtReproductiveHealthDetailsException(
                        "Start an Adult ART Initiation consultation before saving reproductive health details."));
        if (consultation.getArtPathwayCode() != ArtPathwayCode.ADULT_ART_INITIATION) {
            throw new InvalidArtReproductiveHealthDetailsException(
                    "Reproductive health details are only available for Adult ART Initiation visits.");
        }
        return visit;
    }

    public record SaveArtReproductiveHealthDetailsCommand(Boolean pregnant, Integer trimester, String gravida,
            String para, ContraceptionMethod contraceptionMethod, String contraceptionOtherSpecify,
            Boolean urethralDischarge, String urethralDischargeComment,
            Boolean vaginalDischarge, String vaginalDischargeComment,
            Boolean genitalUlcers, String genitalUlcersComment,
            Boolean genitalWarts, String genitalWartsComment,
            Boolean lowerAbdominalPain, String lowerAbdominalPainComment,
            String papSmearResult, java.time.LocalDate papSmearDate, java.time.LocalDate rprDate,
            String results, String specifyTreatmentCompleted) {
    }
}
