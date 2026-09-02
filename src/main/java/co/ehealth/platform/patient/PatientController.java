package co.ehealth.platform.patient;

import co.ehealth.platform.core.security.AuthenticatedPrincipal;
import co.ehealth.platform.identity.Gender;
//import co.ehealth.platform.patient.PatientController.PatientSummary;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PastOrPresent;
import jakarta.validation.constraints.Pattern;

import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.PatchMapping;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
public class PatientController {

        private final PatientService patientService;

        public PatientController(PatientService patientService) {
                this.patientService = patientService;
        }

        @PostMapping("/api/v1/patients")
        public ResponseEntity<PatientSummary> register(@Valid @RequestBody RegisterPatientRequest request,
                        @AuthenticationPrincipal AuthenticatedPrincipal staff) {
                var command = new PatientService.RegisterPatientCommand(request.firstName(), request.lastName(),
                                request.idNumber(), request.passportNumber(), request.dateOfBirth(), request.gender(),
                                request.citizenshipStatus(), request.address(), request.contactNumber(),
                                request.medicalAidProvider(), request.medicalAidNumber());
                Patient patient = patientService.register(command, staff.userId());
                return ResponseEntity.status(HttpStatus.CREATED).body(PatientSummary.from(patient));
        }

        @GetMapping("/api/v1/patients/search")
        public ResponseEntity<Map<String, Object>> search(
                        @RequestParam(required = false) String q,
                        @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dob) {
                List<PatientSummary> items = patientService.search(q, dob).stream().map(PatientSummary::from).toList();
                return ResponseEntity.ok(Map.of("items", items));
        }

        @GetMapping("/api/v1/patients/{id}")
        public ResponseEntity<PatientSummary> get(@PathVariable UUID id) {
                return ResponseEntity.ok(PatientSummary.from(patientService.get(id)));
        }

        @PatchMapping("/api/v1/patients/{id}")
        public ResponseEntity<PatientSummary> update(
                        @PathVariable UUID id,
                        @Valid @RequestBody UpdatePatientRequest request,
                        @AuthenticationPrincipal AuthenticatedPrincipal staff) {
                var command = new PatientService.UpdatePatientCommand(request.firstName(), request.lastName(),
                                request.idNumber(), request.passportNumber(), request.dateOfBirth(), request.gender(),
                                request.citizenshipStatus(), request.address(), request.contactNumber(),
                                request.medicalAidProvider(), request.medicalAidNumber(), request.reasonForChange());
                Patient patient = patientService.update(id, command, staff.userId());
                return ResponseEntity.ok(PatientSummary.from(patient));
        }

        @PostMapping("/api/v1/patients/{id}/deceased")
        public ResponseEntity<PatientSummary> markDeceased(
                        @PathVariable UUID id,
                        @Valid @RequestBody MarkDeceasedRequest request,
                        @AuthenticationPrincipal AuthenticatedPrincipal staff) {
                Patient patient = patientService.markDeceased(id, request.dateOfDeath(), request.confirmDateOfBirth(),
                                staff.userId());
                return ResponseEntity.ok(PatientSummary.from(patient));
        }

        // public record MarkDeceasedRequest(@NotNull @PastOrPresent LocalDate
        // dateOfDeath) {
        // }

        public record MarkDeceasedRequest(
                        @NotNull @PastOrPresent LocalDate dateOfDeath,
                        @NotNull LocalDate confirmDateOfBirth) {
        }

        public record RegisterPatientRequest(
                        @NotBlank String firstName, @NotBlank String lastName,
                        String idNumber, String passportNumber,
                        LocalDate dateOfBirth, Gender gender, CitizenshipStatus citizenshipStatus,
                        @NotBlank String address,
                        @NotBlank @Pattern(regexp = "^\\+?[0-9]{9,15}$") String contactNumber,
                        String medicalAidProvider, String medicalAidNumber) {
        }

        public record UpdatePatientRequest(
                        @NotBlank String firstName, @NotBlank String lastName,
                        String idNumber, String passportNumber,
                        LocalDate dateOfBirth, Gender gender, CitizenshipStatus citizenshipStatus,
                        @NotBlank String address,
                        @NotBlank @Pattern(regexp = "^\\+?[0-9]{9,15}$") String contactNumber,
                        String medicalAidProvider, String medicalAidNumber,
                        String reasonForChange) {
        }

        public record PatientSummary(
                        UUID id,
                        String mpiNumber,
                        String firstName,
                        String lastName,
                        LocalDate dateOfBirth,
                        Gender gender,
                        CitizenshipStatus citizenshipStatus,
                        String idNumber,
                        String passportNumber,
                        String address,
                        String contactNumber,
                        String medicalAidProvider,
                        String medicalAidNumber,
                        Instant createdAt) {

                static PatientSummary from(Patient p) {
                        return new PatientSummary(
                                        p.getId(),
                                        p.getMpiNumber(),
                                        p.getFirstName(),
                                        p.getLastName(),
                                        p.getDateOfBirth(),
                                        p.getGender(),
                                        p.getCitizenshipStatus(),
                                        p.getIdNumber(),
                                        p.getPassportNumber(),
                                        p.getAddress(),
                                        p.getContactNumber(),
                                        p.getMedicalAidProvider(),
                                        p.getMedicalAidNumber(),
                                        p.getCreatedAt());
                }
        }
}
