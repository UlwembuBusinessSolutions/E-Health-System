package co.ehealth.platform.patient;

import co.ehealth.platform.core.audit.AuditLogService;
import co.ehealth.platform.core.tenant.ModuleCode;
import co.ehealth.platform.core.tenant.OrganizationRepository;
import co.ehealth.platform.core.tenant.OrganizationSector;
import co.ehealth.platform.core.tenant.TenantContext;
import co.ehealth.platform.identity.DuplicateFieldException;
import co.ehealth.platform.identity.PermissionLevel;
import co.ehealth.platform.identity.PermissionService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@Service
public class PatientService {

    private final PatientRepository patientRepository;
    private final AuditLogService auditLogService;
    private final Clock clock;
    private final PermissionService permissionService;
    private final OrganizationRepository organizationRepository;

    public PatientService(PatientRepository patientRepository, AuditLogService auditLogService, Clock clock,
                           PermissionService permissionService, OrganizationRepository organizationRepository) {
        this.patientRepository = patientRepository;
        this.auditLogService = auditLogService;
        this.clock = clock;
        this.permissionService = permissionService;
        this.organizationRepository = organizationRepository;
    }

    // PREG-US-001: "an EPR is created and a unique MPI number is
    // generated ... the patient is immediately available in search and an
    // AUDT PATIENT_REGISTERED event is recorded." idNumber is the only
    // identity input the form takes — dateOfBirth/gender/citizenship all
    // come from SouthAfricanIdNumber.parse(), never from the request
    // directly, so there's no way for a caller to submit a DOB that
    // disagrees with the ID number it was supposedly derived from.
    @Transactional
    public Patient register(RegisterPatientCommand cmd, UUID registeredByUserId) {
        permissionService.requireAccess(ModuleCode.PREG, PermissionLevel.MANAGE);
        OrganizationSector sector = organizationRepository.findBySchemaName(TenantContext.getCurrentTenant())
                .orElseThrow(() -> new IllegalStateException("Unknown organization for current tenant"))
                .getSector();
        if (sector == OrganizationSector.OCCUPATIONAL
                && (cmd.employer() == null || cmd.employer().isBlank()
                || cmd.employeeNumber() == null || cmd.employeeNumber().isBlank())) {
            throw new OccupationalEmploymentRequiredException();
        }
        if (patientRepository.existsByIdNumber(cmd.idNumber())) {
            throw new DuplicateFieldException("idNumber", "A patient with this ID number is already registered.");
        }
        SouthAfricanIdNumber parsed = SouthAfricanIdNumber.parse(cmd.idNumber());
        if (cmd.nextOfKin().isEmpty() && parsed.dateOfBirth().isAfter(LocalDate.now(clock).minusYears(18))) {
            throw new MinorNextOfKinRequiredException();
        }

        String mpiNumber = "MPI-" + String.format("%07d", patientRepository.nextMpiSequenceValue());
        Patient patient = new Patient(mpiNumber, cmd.firstName(), cmd.lastName(), parsed.dateOfBirth(),
                parsed.gender(), parsed.citizenshipStatus(), cmd.idNumber(), cmd.address(), cmd.contactNumber(),
                cmd.medicalAidProvider(), cmd.medicalAidNumber(), cmd.employer(), cmd.employeeNumber(),
                cmd.occupation(), cmd.department(), cmd.nextOfKin(), registeredByUserId, clock.instant());
        patientRepository.save(patient);

        auditLogService.append(registeredByUserId, null, "PATIENT_REGISTERED", "Patient",
                patient.getId().toString(), null, null);

        return patient;
    }

    public Patient get(UUID id) {
        permissionService.requireAccess(ModuleCode.PREG, PermissionLevel.VIEW);
        return patientRepository.findWithNextOfKinById(id).orElseThrow(PatientNotFoundException::new);
    }

    // PREG-US-008: "matching results are returned within 3 seconds ...
    // offers registration path on no-match" — the second half is a
    // frontend concern (an empty result set is enough for the UI to show
    // that path), nothing this method needs to special-case.
    public List<Patient> search(String query) {
        permissionService.requireAccess(ModuleCode.PREG, PermissionLevel.VIEW);
        String trimmed = query == null ? "" : query.trim();
        if (trimmed.isEmpty()) {
            return List.of();
        }
        return patientRepository.search(trimmed);
    }

    public record RegisterPatientCommand(String firstName, String lastName, String idNumber, String address,
                                          String contactNumber, String medicalAidProvider,
                                          String medicalAidNumber, String employer, String employeeNumber,
                                          String occupation, String department, List<NextOfKin> nextOfKin) {
    }
}
