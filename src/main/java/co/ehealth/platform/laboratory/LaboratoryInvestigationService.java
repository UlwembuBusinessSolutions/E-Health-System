package co.ehealth.platform.laboratory;

import co.ehealth.platform.core.audit.AuditLogService;
import co.ehealth.platform.core.tenant.ModuleCode;
import co.ehealth.platform.identity.PermissionLevel;
import co.ehealth.platform.identity.PermissionService;
import co.ehealth.platform.patient.Patient;
import co.ehealth.platform.patient.PatientArchivedException;
import co.ehealth.platform.patient.PatientService;
import co.ehealth.platform.visit.Visit;
import co.ehealth.platform.visit.VisitNotFoundException;
import co.ehealth.platform.visit.VisitRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.Clock;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.UUID;

@Service
public class LaboratoryInvestigationService {

    private static final Set<String> CLINICAL_ROLES =
            Set.of("Professional Nurse", "Doctor", "Clinician", "Occupational Health Practitioner");
    private static final int MAX_BATCH_SIZE = 50;
    private static final int MAX_TEST_NAME_LENGTH = 200;
    private static final int MAX_RESULTS_LENGTH = 10_000;

    private final LaboratoryInvestigationRepository investigationRepository;
    private final VisitRepository visitRepository;
    private final PatientService patientService;
    private final PermissionService permissionService;
    private final AuditLogService auditLogService;
    private final Clock clock;

    public LaboratoryInvestigationService(LaboratoryInvestigationRepository investigationRepository,
            VisitRepository visitRepository, PatientService patientService, PermissionService permissionService,
            AuditLogService auditLogService, Clock clock) {
        this.investigationRepository = investigationRepository;
        this.visitRepository = visitRepository;
        this.patientService = patientService;
        this.permissionService = permissionService;
        this.auditLogService = auditLogService;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public List<LaboratoryInvestigation> listForVisit(UUID visitId) {
        requireReadAccess();
        visitRepository.findById(visitId).orElseThrow(VisitNotFoundException::new);
        return investigationRepository.findByVisitIdOrderByInvestigationDateDescCreatedAtDesc(visitId);
    }

    @Transactional
    public List<LaboratoryInvestigation> save(UUID visitId, List<CreateLaboratoryInvestigationCommand> commands,
                                               UUID staffUserId) {
        permissionService.requireAccess(ModuleCode.RECQ, PermissionLevel.MANAGE);
        permissionService.requireAnyRole(CLINICAL_ROLES, "Only clinical staff may save laboratory investigations.");
        if (commands == null || commands.isEmpty() || commands.size() > MAX_BATCH_SIZE) {
            throw new InvalidLaboratoryInvestigationException(
                    "Save between 1 and " + MAX_BATCH_SIZE + " laboratory investigations at a time.");
        }

        Visit visit = visitRepository.findById(visitId).orElseThrow(VisitNotFoundException::new);
        if (visit.getPatientId() != null) {
            Patient patient = patientService.get(visit.getPatientId());
            if (patient.isArchived()) {
                throw new PatientArchivedException();
            }
        }

        List<LaboratoryInvestigation> investigations = new ArrayList<>(commands.size());
        for (CreateLaboratoryInvestigationCommand command : commands) {
            if (command.investigationDate() == null) {
                throw new InvalidLaboratoryInvestigationException("A test date is required.");
            }
            if (!StringUtils.hasText(command.testName()) || command.testName().trim().length() > MAX_TEST_NAME_LENGTH) {
                throw new InvalidLaboratoryInvestigationException(
                        "A test name of 1 to " + MAX_TEST_NAME_LENGTH + " characters is required.");
            }
            if (!StringUtils.hasText(command.testResults())
                    || command.testResults().trim().length() > MAX_RESULTS_LENGTH) {
                throw new InvalidLaboratoryInvestigationException(
                        "Test results of 1 to " + MAX_RESULTS_LENGTH + " characters are required.");
            }
            investigations.add(new LaboratoryInvestigation(visitId, command.investigationDate(),
                    command.testName().trim(), command.testResults().trim(), staffUserId, clock.instant()));
        }

        List<LaboratoryInvestigation> saved = investigationRepository.saveAll(investigations);
        for (LaboratoryInvestigation investigation : saved) {
            auditLogService.append(staffUserId, visit.getFacilityId(), "LABORATORY_INVESTIGATION_SIGNED",
                    "LaboratoryInvestigation", investigation.getId().toString(), null, null);
        }
        return saved;
    }

    private void requireReadAccess() {
        permissionService.requireAccess(ModuleCode.RECQ, PermissionLevel.VIEW);
        permissionService.requireAnyRole(CLINICAL_ROLES, "Only clinical staff may view laboratory investigations.");
    }

    public record CreateLaboratoryInvestigationCommand(LocalDate investigationDate, String testName,
                                                        String testResults) {
    }
}
