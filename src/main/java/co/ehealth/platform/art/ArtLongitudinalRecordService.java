package co.ehealth.platform.art;

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
import java.util.List;
import java.util.Set;
import java.util.UUID;

@Service
public class ArtLongitudinalRecordService {

    private static final Set<String> CLINICAL_ROLES =
            Set.of("Professional Nurse", "Doctor", "Clinician", "Occupational Health Practitioner");
    private static final int MAX_DURATION_LENGTH = 200;
    private static final int MAX_MEASUREMENT_LENGTH = 200;
    private static final int MAX_DESCRIPTION_LENGTH = 10_000;

    private final ArtLongitudinalRecordRepository recordRepository;
    private final VisitRepository visitRepository;
    private final PatientService patientService;
    private final PermissionService permissionService;
    private final AuditLogService auditLogService;
    private final Clock clock;

    public ArtLongitudinalRecordService(ArtLongitudinalRecordRepository recordRepository,
            VisitRepository visitRepository, PatientService patientService, PermissionService permissionService,
            AuditLogService auditLogService, Clock clock) {
        this.recordRepository = recordRepository;
        this.visitRepository = visitRepository;
        this.patientService = patientService;
        this.permissionService = permissionService;
        this.auditLogService = auditLogService;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public List<ArtLongitudinalRecord> listForVisit(UUID visitId) {
        requireReadAccess();
        requireChronicCareVisit(visitId);
        return recordRepository.findByVisitIdOrderByRecordDateDescCreatedAtDesc(visitId);
    }

    @Transactional
    public ArtLongitudinalRecord save(UUID visitId, CreateArtLongitudinalRecordCommand command, UUID staffUserId) {
        permissionService.requireAccess(ModuleCode.RECQ, PermissionLevel.MANAGE);
        permissionService.requireAnyRole(CLINICAL_ROLES, "Only clinical staff may save ART longitudinal records.");
        if (command.recordDate() == null) {
            throw new InvalidArtLongitudinalRecordException("A record date is required.");
        }
        if (command.stage() == null) {
            throw new InvalidArtLongitudinalRecordException("Select an ART stage.");
        }
        validateLength(command.durationOnArt(), MAX_DURATION_LENGTH, "Duration on ART");
        validateLength(command.viralLoad(), MAX_MEASUREMENT_LENGTH, "Viral load");
        validateLength(command.cd4Count(), MAX_MEASUREMENT_LENGTH, "CD4 count");
        validateLength(command.stageDescription(), MAX_DESCRIPTION_LENGTH, "Stage description");

        Visit visit = requireChronicCareVisit(visitId);
        if (visit.getPatientId() != null) {
            Patient patient = patientService.get(visit.getPatientId());
            if (patient.isArchived()) {
                throw new PatientArchivedException();
            }
        }

        ArtLongitudinalRecord record = new ArtLongitudinalRecord(visitId, command.recordDate(),
                normalize(command.durationOnArt()), command.stage(), normalize(command.viralLoad()),
                normalize(command.cd4Count()), normalize(command.stageDescription()), staffUserId, clock.instant());
        ArtLongitudinalRecord saved = recordRepository.save(record);
        auditLogService.append(staffUserId, visit.getFacilityId(), "ART_LONGITUDINAL_RECORD_SIGNED",
                "ArtLongitudinalRecord", saved.getId().toString(), null, null);
        return saved;
    }

    private void requireReadAccess() {
        permissionService.requireAccess(ModuleCode.RECQ, PermissionLevel.VIEW);
        permissionService.requireAnyRole(CLINICAL_ROLES, "Only clinical staff may view ART longitudinal records.");
    }

    private Visit requireChronicCareVisit(UUID visitId) {
        Visit visit = visitRepository.findById(visitId).orElseThrow(VisitNotFoundException::new);
        if (visit.getServiceStream() != ServiceStream.CHRONIC_CARE) {
            throw new InvalidArtLongitudinalRecordException(
                    "ART longitudinal records are only available for chronic-care visits.");
        }
        return visit;
    }

    private static String normalize(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private static void validateLength(String value, int maxLength, String label) {
        if (value != null && value.trim().length() > maxLength) {
            throw new InvalidArtLongitudinalRecordException(label + " must be " + maxLength + " characters or fewer.");
        }
    }

    public record CreateArtLongitudinalRecordCommand(LocalDate recordDate, String durationOnArt, ArtStage stage,
                                                       String viralLoad, String cd4Count, String stageDescription) {
    }
}
