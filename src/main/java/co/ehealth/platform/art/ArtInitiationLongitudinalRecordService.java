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
import java.math.BigDecimal;
import java.time.Clock;
import java.util.List;
import java.util.Set;
import java.util.UUID;

@Service
public class ArtInitiationLongitudinalRecordService {
    private static final Set<String> CLINICAL_ROLES =
            Set.of("Professional Nurse", "Doctor", "Clinician", "Occupational Health Practitioner");
    private static final int MAX_MEASUREMENT_LENGTH = 200;
    private static final int MAX_DESCRIPTION_LENGTH = 10_000;

    private final ArtInitiationLongitudinalRecordRepository recordRepository;
    private final VisitRepository visitRepository;
    private final ConsultationRepository consultationRepository;
    private final PatientService patientService;
    private final PermissionService permissionService;
    private final AuditLogService auditLogService;
    private final Clock clock;

    public ArtInitiationLongitudinalRecordService(ArtInitiationLongitudinalRecordRepository recordRepository,
            VisitRepository visitRepository, ConsultationRepository consultationRepository,
            PatientService patientService, PermissionService permissionService,
            AuditLogService auditLogService, Clock clock) {
        this.recordRepository = recordRepository;
        this.visitRepository = visitRepository;
        this.consultationRepository = consultationRepository;
        this.patientService = patientService;
        this.permissionService = permissionService;
        this.auditLogService = auditLogService;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public List<ArtInitiationLongitudinalRecord> listForVisit(UUID visitId) {
        requireReadAccess();
        requireArtInitiationVisit(visitId);
        return recordRepository.findByVisitIdOrderByRecordDateDescSignedAtDesc(visitId);
    }

    @Transactional
    public ArtInitiationLongitudinalRecord save(UUID visitId, CreateCommand command, UUID staffUserId) {
        permissionService.requireAccess(ModuleCode.RECQ, PermissionLevel.MANAGE);
        permissionService.requireAnyRole(CLINICAL_ROLES, "Only clinical staff may save ART initiation longitudinal records.");
        if (command.recordDate() == null) throw new InvalidArtInitiationLongitudinalRecordException("A record date is required.");
        if (command.stage() == null) throw new InvalidArtInitiationLongitudinalRecordException("Select an ART stage.");
        if (command.durationOnArtMonths() != null && command.durationOnArtMonths() < 0) {
            throw new InvalidArtInitiationLongitudinalRecordException("Duration on ART cannot be negative.");
        }
        BigDecimal weight = command.patientWeightKg();
        if (weight != null && (weight.signum() <= 0 || weight.scale() > 2 || weight.precision() > 6)) {
            throw new InvalidArtInitiationLongitudinalRecordException("Patient weight must be greater than zero and have at most two decimal places.");
        }
        validateLength(command.viralLoad(), MAX_MEASUREMENT_LENGTH, "Viral load");
        validateLength(command.cd4Count(), MAX_MEASUREMENT_LENGTH, "CD4 count");
        validateLength(command.stageDescription(), MAX_DESCRIPTION_LENGTH, "Stage description");

        Visit visit = requireArtInitiationVisit(visitId);
        if (visit.getPatientId() != null) {
            Patient patient = patientService.get(visit.getPatientId());
            if (patient.isArchived()) throw new PatientArchivedException();
        }

        ArtInitiationLongitudinalRecord record = new ArtInitiationLongitudinalRecord(
                visitId, command.recordDate(), command.durationOnArtMonths(), command.stage(),
                weight, normalize(command.viralLoad()), normalize(command.cd4Count()),
                normalize(command.stageDescription()), staffUserId, clock.instant());
        ArtInitiationLongitudinalRecord saved = recordRepository.save(record);
        auditLogService.append(staffUserId, visit.getFacilityId(), "ART_INITIATION_LONGITUDINAL_RECORD_SIGNED",
                "ArtInitiationLongitudinalRecord", saved.getId().toString(), null, null);
        return saved;
    }

    private void requireReadAccess() {
        permissionService.requireAccess(ModuleCode.RECQ, PermissionLevel.VIEW);
        permissionService.requireAnyRole(CLINICAL_ROLES, "Only clinical staff may view ART initiation longitudinal records.");
    }

    private Visit requireArtInitiationVisit(UUID visitId) {
        Visit visit = visitRepository.findById(visitId).orElseThrow(VisitNotFoundException::new);
        if (visit.getServiceStream() != ServiceStream.CHRONIC_CARE) {
            throw new InvalidArtInitiationLongitudinalRecordException("ART initiation longitudinal records are only available for chronic-care visits.");
        }
        Consultation consultation = consultationRepository
                .findFirstByVisitIdAndStatusOrderByCreatedAtDesc(visitId, ConsultationStatus.DRAFT)
                .or(() -> consultationRepository.findFirstByVisitIdAndStatusOrderByCreatedAtDesc(
                        visitId, ConsultationStatus.SIGNED))
                .orElseThrow(() -> new InvalidArtInitiationLongitudinalRecordException(
                        "Start an Adult ART Initiation consultation before saving longitudinal records."));
        if (consultation.getArtPathwayCode() != ArtPathwayCode.ADULT_ART_INITIATION) {
            throw new InvalidArtInitiationLongitudinalRecordException(
                    "These longitudinal records are only available for Adult ART Initiation visits.");
        }
        return visit;
    }

    private static String normalize(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private static void validateLength(String value, int maxLength, String label) {
        if (value != null && value.trim().length() > maxLength) {
            throw new InvalidArtInitiationLongitudinalRecordException(label + " must be " + maxLength + " characters or fewer.");
        }
    }

    public record CreateCommand(java.time.LocalDate recordDate, Integer durationOnArtMonths,
            ArtStage stage, BigDecimal patientWeightKg, String viralLoad, String cd4Count,
            String stageDescription) {}
}
