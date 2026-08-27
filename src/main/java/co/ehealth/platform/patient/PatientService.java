package co.ehealth.platform.patient;

import co.ehealth.platform.core.audit.AuditLogService;
import co.ehealth.platform.core.tenant.ModuleCode;
import co.ehealth.platform.identity.DuplicateFieldException;
import co.ehealth.platform.identity.PermissionLevel;
import co.ehealth.platform.identity.PermissionService;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.util.List;
import java.util.UUID;

@Service
public class PatientService {

    private final PatientRepository patientRepository;
    private final AuditLogService auditLogService;
    private final Clock clock;
    private final PermissionService permissionService;
    private final ObjectMapper objectMapper;

    public PatientService(PatientRepository patientRepository, AuditLogService auditLogService, Clock clock,
                           PermissionService permissionService, ObjectMapper objectMapper) {
        this.patientRepository = patientRepository;
        this.auditLogService = auditLogService;
        this.clock = clock;
        this.permissionService = permissionService;
        this.objectMapper = objectMapper;
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
        if (patientRepository.existsByIdNumber(cmd.idNumber())) {
            throw new DuplicateFieldException("idNumber", "A patient with this ID number is already registered.");
        }
        SouthAfricanIdNumber parsed = SouthAfricanIdNumber.parse(cmd.idNumber());

        String mpiNumber = "MPI-" + String.format("%07d", patientRepository.nextMpiSequenceValue());
        Patient patient = new Patient(mpiNumber, cmd.firstName(), cmd.lastName(), parsed.dateOfBirth(),
                parsed.gender(), parsed.citizenshipStatus(), cmd.idNumber(), cmd.address(), cmd.contactNumber(),
                cmd.medicalAidProvider(), cmd.medicalAidNumber(), registeredByUserId, clock.instant());
        patientRepository.save(patient);

        auditLogService.append(registeredByUserId, null, "PATIENT_REGISTERED", "Patient",
                patient.getId().toString(), null, null);

        return patient;
    }

    public Patient get(UUID id) {
        permissionService.requireAccess(ModuleCode.PREG, PermissionLevel.VIEW);
        return patientRepository.findById(id).orElseThrow(PatientNotFoundException::new);
    }

    // PREG-US-009's edit transition must not turn the pre-populated form
    // into an unaudited write path. A replacement ID is parsed exactly as it
    // is on registration, keeping its derived DOB/gender/citizenship fields
    // internally consistent. The MPI is never editable.
    @Transactional
    public Patient updateDemographics(UUID id, UpdatePatientCommand cmd, UUID updatedByUserId) {
        permissionService.requireAccess(ModuleCode.PREG, PermissionLevel.MANAGE);
        Patient patient = patientRepository.findById(id).orElseThrow(PatientNotFoundException::new);
        if (!patient.getIdNumber().equals(cmd.idNumber())
                && patientRepository.existsByIdNumberAndIdNot(cmd.idNumber(), id)) {
            throw new DuplicateFieldException("idNumber", "A patient with this ID number is already registered.");
        }

        String before = demographicsSnapshot(patient);
        SouthAfricanIdNumber parsed = SouthAfricanIdNumber.parse(cmd.idNumber());
        patient.updateDemographics(cmd.firstName(), cmd.lastName(), parsed.dateOfBirth(), parsed.gender(),
                parsed.citizenshipStatus(), cmd.idNumber(), cmd.address(), cmd.contactNumber(),
                cmd.medicalAidProvider(), cmd.medicalAidNumber());
        String after = demographicsSnapshot(patient);

        if (!before.equals(after)) {
            auditLogService.append(updatedByUserId, null, "PATIENT_UPDATED", "Patient", patient.getId().toString(),
                    before, after);
        }
        return patient;
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
                                          String medicalAidNumber) {
    }

    public record UpdatePatientCommand(String firstName, String lastName, String idNumber, String address,
                                       String contactNumber, String medicalAidProvider, String medicalAidNumber) {
    }

    private String demographicsSnapshot(Patient patient) {
        try {
            return objectMapper.writeValueAsString(new DemographicsSnapshot(patient.getFirstName(),
                    patient.getLastName(), patient.getDateOfBirth(), patient.getGender(),
                    patient.getCitizenshipStatus(), patient.getIdNumber(), patient.getAddress(),
                    patient.getContactNumber(), patient.getMedicalAidProvider(), patient.getMedicalAidNumber()));
        } catch (JsonProcessingException ex) {
            // Every member is a simple scalar, so this indicates a broken server
            // configuration rather than client input; never write a partial audit row.
            throw new IllegalStateException("Could not serialize patient audit snapshot", ex);
        }
    }

    private record DemographicsSnapshot(String firstName, String lastName, java.time.LocalDate dateOfBirth,
                                        co.ehealth.platform.identity.Gender gender,
                                        CitizenshipStatus citizenshipStatus, String idNumber, String address,
                                        String contactNumber, String medicalAidProvider, String medicalAidNumber) {
    }
}
