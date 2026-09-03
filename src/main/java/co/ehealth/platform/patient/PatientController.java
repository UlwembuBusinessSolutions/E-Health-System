package co.ehealth.platform.patient;

import co.ehealth.platform.core.security.AuthenticatedPrincipal;
import co.ehealth.platform.identity.Gender;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;

// No @RequestMapping("/api/v1/admin/...") — registering and finding a
// patient is front-line reception/clinical work (Admin/Reception Officer,
// Professional Nurse in the role catalogue), not admin territory the way
// staff management is. Falls through SecurityConfig's .anyRequest().authenticated()
// same as GET /api/v1/facilities and /api/v1/roles: any authenticated
// staff member, not ORG_ADMIN-gated.
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
                request.idNumber(), request.address(), request.contactNumber(), request.medicalAidProvider(),
                request.medicalAidNumber());
        Patient patient = patientService.register(command, staff.userId());
        return ResponseEntity.status(HttpStatus.CREATED).body(PatientSummary.from(patient));
    }

    // PREG-US-008 — empty/blank q returns no results rather than the whole
    // roster; PatientService.search()'s own why-note.
    @GetMapping("/api/v1/patients/search")
    public ResponseEntity<Map<String, Object>> search(@RequestParam(required = false) String q) {
        List<PatientSummary> items = patientService.search(q).stream().map(PatientSummary::from).toList();
        return ResponseEntity.ok(Map.of("items", items));
    }

    @GetMapping("/api/v1/patients/{id}")
    public ResponseEntity<PatientSummary> get(@PathVariable UUID id) {
        return ResponseEntity.ok(PatientSummary.from(patientService.get(id)));
    }

    // The UI calls this only after its explicit "Edit demographics" action.
    // A complete replacement avoids ambiguous partial state, and the service
    // records a full before/after snapshot for every real change.
    @PatchMapping("/api/v1/patients/{id}")
    public ResponseEntity<PatientSummary> update(@PathVariable UUID id,
            @Valid @RequestBody UpdatePatientRequest request,
            @AuthenticationPrincipal AuthenticatedPrincipal staff) {
        Patient patient = patientService.updateDemographics(id,
                new PatientService.UpdatePatientCommand(request.firstName(), request.lastName(), request.idNumber(),
                        request.address(), request.contactNumber(), request.medicalAidProvider(),
                        request.medicalAidNumber()), staff.userId());
        return ResponseEntity.ok(PatientSummary.from(patient));
    }

    public record RegisterPatientRequest(
            @NotBlank String firstName, @NotBlank String lastName,
            @NotBlank @Pattern(regexp = "^\\d{13}$", message = "ID number must be 13 digits") String idNumber,
            @NotBlank String address,
            @NotBlank @Pattern(regexp = "^\\+?[0-9]{9,15}$") String contactNumber,
            String medicalAidProvider, String medicalAidNumber) {
    }

    public record UpdatePatientRequest(
            @NotBlank @Size(max = 100) String firstName, @NotBlank @Size(max = 100) String lastName,
            @NotBlank @Pattern(regexp = "^\\d{13}$", message = "ID number must be 13 digits") String idNumber,
            @NotBlank @Size(max = 500) String address,
            @NotBlank @Pattern(regexp = "^\\+?[0-9]{9,15}$") String contactNumber,
            @Size(max = 100) String medicalAidProvider, @Size(max = 50) String medicalAidNumber) {
    }

    // idNumber is included, not masked — reception/admin staff handle ID
    // numbers routinely as part of registration and lookup, unlike a
    // password hash there's no leaked-credential risk in returning it back
    // to the same tenant's own authenticated staff.
    public record PatientSummary(UUID id, String mpiNumber, String firstName, String lastName,
                                  LocalDate dateOfBirth, Gender gender, CitizenshipStatus citizenshipStatus,
                                  String idNumber, String address, String contactNumber, String medicalAidProvider,
                                  String medicalAidNumber, Instant createdAt) {
        static PatientSummary from(Patient p) {
            return new PatientSummary(p.getId(), p.getMpiNumber(), p.getFirstName(), p.getLastName(),
                    p.getDateOfBirth(), p.getGender(), p.getCitizenshipStatus(), p.getIdNumber(), p.getAddress(),
                    p.getContactNumber(), p.getMedicalAidProvider(), p.getMedicalAidNumber(), p.getCreatedAt());
        }
    }
}
