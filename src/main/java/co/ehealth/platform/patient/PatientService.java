package co.ehealth.platform.patient;

import co.ehealth.platform.core.audit.AuditLogService;
import co.ehealth.platform.core.tenant.DateOfBirthMismatchException;
import co.ehealth.platform.core.tenant.ModuleCode;
import co.ehealth.platform.identity.DuplicateFieldException;
import co.ehealth.platform.identity.Gender;
import co.ehealth.platform.identity.PermissionLevel;
import co.ehealth.platform.identity.PermissionService;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Objects;
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

    @Transactional
    public Patient register(RegisterPatientCommand cmd, UUID registeredByUserId) {
        permissionService.requireAccess(ModuleCode.PREG, PermissionLevel.MANAGE);
        // permissionService.requireAnyRole("ORG_ADMIN", "Admin Staff");

        if (cmd.idNumber() == null && cmd.passportNumber() == null) {
            throw new IllegalArgumentException("Either an ID number or a passport number is required.");
        }

        if (cmd.idNumber() != null && patientRepository.existsByIdNumber(cmd.idNumber())) {
            throw new DuplicateFieldException("idNumber", "A patient with this ID number is already registered.");
        }
        if (cmd.passportNumber() != null && patientRepository.existsByPassportNumber(cmd.passportNumber())) {
            throw new DuplicateFieldException("passportNumber",
                    "A patient with this passport number is already registered.");
        }

        LocalDate dateOfBirth;
        Gender gender;
        CitizenshipStatus citizenship;

        if (cmd.idNumber() != null) {
            SouthAfricanIdNumber parsed = SouthAfricanIdNumber.parse(cmd.idNumber());
            dateOfBirth = parsed.dateOfBirth();
            gender = parsed.gender();
            citizenship = parsed.citizenshipStatus();
        } else {
            dateOfBirth = cmd.dateOfBirth();
            gender = cmd.gender();
            citizenship = cmd.citizenshipStatus();
        }

        String mpiNumber = "MPI-" + String.format("%07d", patientRepository.nextMpiSequenceValue());
        Patient patient = new Patient(mpiNumber, cmd.firstName(), cmd.lastName(), dateOfBirth,
                gender, citizenship, cmd.idNumber(), cmd.passportNumber(), cmd.address(), cmd.contactNumber(),
                cmd.medicalAidProvider(), cmd.medicalAidNumber(), registeredByUserId, clock.instant());
        patientRepository.save(patient);

        auditLogService.append(registeredByUserId, null, "PATIENT_REGISTERED", "Patient",
                patient.getId().toString(), null, null);

        return patient;
    }

    @Transactional
    public Patient update(UUID id, UpdatePatientCommand cmd, UUID actingUserId) {
        // permissionService.requireAccess(ModuleCode.PREG, PermissionLevel.MANAGE);
        permissionService.requireAnyRole("ORG_ADMIN", "Admin Staff");
        Patient patient = patientRepository.findById(id).orElseThrow(PatientNotFoundException::new);

        if (patient.isDeceased()) {
            throw new PatientArchivedException();
        }

        if (cmd.idNumber() == null && cmd.passportNumber() == null) {
            throw new IllegalArgumentException("Either an ID number or a passport number is required.");
        }

        if (cmd.idNumber() != null && !cmd.idNumber().equals(patient.getIdNumber())
                && patientRepository.existsByIdNumber(cmd.idNumber())) {
            throw new DuplicateFieldException("idNumber", "A patient with this ID number is already registered.");
        }
        if (cmd.passportNumber() != null && !cmd.passportNumber().equals(patient.getPassportNumber())
                && patientRepository.existsByPassportNumber(cmd.passportNumber())) {
            throw new DuplicateFieldException("passportNumber",
                    "A patient with this passport number is already registered.");
        }

        LocalDate dateOfBirth;
        Gender gender;
        CitizenshipStatus citizenship;
        String idNumber;
        String passportNumber;

        if (cmd.idNumber() != null) {
            SouthAfricanIdNumber parsed = SouthAfricanIdNumber.parse(cmd.idNumber());
            dateOfBirth = parsed.dateOfBirth();
            gender = parsed.gender();
            citizenship = parsed.citizenshipStatus();
            idNumber = cmd.idNumber();
            passportNumber = null;
        } else {
            dateOfBirth = cmd.dateOfBirth();
            gender = cmd.gender();
            citizenship = cmd.citizenshipStatus();
            idNumber = null;
            passportNumber = cmd.passportNumber();
        }

        boolean significantChange = !Objects.equals(idNumber, patient.getIdNumber())
                || !Objects.equals(passportNumber, patient.getPassportNumber())
                || !Objects.equals(dateOfBirth, patient.getDateOfBirth())
                || gender != patient.getGender()
                || citizenship != patient.getCitizenshipStatus();

        if (significantChange && (cmd.reasonForChange() == null || cmd.reasonForChange().isBlank())) {
            throw new ReasonForChangeRequiredException();
        }

        String beforeValue = serializeSnapshot(patient, null);

        patient.setFirstName(cmd.firstName());
        patient.setLastName(cmd.lastName());
        patient.setIdNumber(idNumber);
        patient.setPassportNumber(passportNumber);
        patient.setDateOfBirth(dateOfBirth);
        patient.setGender(gender);
        patient.setCitizenshipStatus(citizenship);
        patient.setAddress(cmd.address());
        patient.setContactNumber(cmd.contactNumber());
        patient.setMedicalAidProvider(cmd.medicalAidProvider());
        patient.setMedicalAidNumber(cmd.medicalAidNumber());
        patientRepository.save(patient);

        String afterValue = serializeSnapshot(patient, cmd.reasonForChange());

        auditLogService.append(actingUserId, null, "PATIENT_UPDATED", "Patient", patient.getId().toString(),
                beforeValue, afterValue);

        return patient;
    }

    private String serializeSnapshot(Patient patient, String reasonForChange) {
        try {
            return objectMapper.writeValueAsString(new PatientSnapshot(patient.getFirstName(), patient.getLastName(),
                    patient.getIdNumber(), patient.getPassportNumber(), patient.getDateOfBirth(), patient.getGender(),
                    patient.getCitizenshipStatus(), patient.getAddress(), patient.getContactNumber(),
                    patient.getMedicalAidProvider(), patient.getMedicalAidNumber(), reasonForChange));
        } catch (JsonProcessingException e) {
            return null;
        }
    }

    private record PatientSnapshot(String firstName, String lastName, String idNumber, String passportNumber,
            LocalDate dateOfBirth, Gender gender, CitizenshipStatus citizenshipStatus, String address,
            String contactNumber, String medicalAidProvider, String medicalAidNumber, String reasonForChange) {
    }

    public Patient get(UUID id) {
        permissionService.requireAccess(ModuleCode.PREG, PermissionLevel.VIEW);
        return patientRepository.findById(id).orElseThrow(PatientNotFoundException::new);
    }

    public List<Patient> search(String query, LocalDate dob) {
        permissionService.requireAccess(ModuleCode.PREG, PermissionLevel.VIEW);
        String trimmed = query == null ? "" : query.trim();
        if (trimmed.isEmpty() && dob == null) {
            return List.of();
        }
        return patientRepository.search(trimmed, dob).stream().filter(p -> !p.isDeceased()).toList();
    }

    public record RegisterPatientCommand(
            String firstName, String lastName, String idNumber, String passportNumber,
            LocalDate dateOfBirth, Gender gender, CitizenshipStatus citizenshipStatus, String address,
            String contactNumber, String medicalAidProvider, String medicalAidNumber) {
    }

    public record UpdatePatientCommand(
            String firstName, String lastName, String idNumber, String passportNumber,
            LocalDate dateOfBirth, Gender gender, CitizenshipStatus citizenshipStatus, String address,
            String contactNumber, String medicalAidProvider, String medicalAidNumber, String reasonForChange) {
    }

    @Transactional
    public Patient markDeceased(UUID id, LocalDate dateOfDeath, LocalDate confirmDateOfBirth, UUID actingUserId) {
        permissionService.requireAnyRole("ORG_ADMIN", "Admin Staff");

        Patient patient = patientRepository.findById(id).orElseThrow(PatientNotFoundException::new);

        if (patient.isDeceased()) {
            throw new PatientArchivedException();
        }

        if (!patient.getDateOfBirth().equals(confirmDateOfBirth)) {
            throw new DateOfBirthMismatchException();
        }

        if (dateOfDeath.isAfter(LocalDate.now(clock))) {
            throw new IllegalArgumentException("Date of death cannot be in the future.");
        }

        String beforeValue = serializeSnapshot(patient, null);
        Instant now = clock.instant();
        patient.markDeceased(dateOfDeath, actingUserId, now);
        patientRepository.save(patient);
        String afterValue = serializeSnapshot(patient, "Marked deceased");

        auditLogService.append(actingUserId, null, "PATIENT_MARKED_DECEASED", "Patient",
                patient.getId().toString(), beforeValue, afterValue);

        return patient;
    }
}
