package co.ehealth.platform.patient;

import co.ehealth.platform.core.security.PatientJwtService;
import co.ehealth.platform.core.security.PatientPrincipal;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

// The patient portal's own /api/v1/auth-shaped surface — mirrors
// identity.AuthController field-for-field (register/login/logout/me),
// just with an extra self-service /register endpoint staff accounts don't
// need (StaffController/PlatformOperatorController create accounts for
// someone else; here the patient creates their own). Covered by
// SecurityConfig's /api/v1/patient/register + /api/v1/patient/auth/login
// permitAll rules and the PatientJwtAuthenticationFilter for everything
// else under /api/v1/patient/**.
@RestController
@RequestMapping("/api/v1/patient")
public class PatientAuthController {

    private final PatientAuthService patientAuthService;
    private final PatientAccountRepository patientAccountRepository;

    public PatientAuthController(PatientAuthService patientAuthService,
                                  PatientAccountRepository patientAccountRepository) {
        this.patientAuthService = patientAuthService;
        this.patientAccountRepository = patientAccountRepository;
    }

    @PostMapping("/register")
    public ResponseEntity<AuthResponse> register(@Valid @RequestBody RegisterRequest request) {
        PatientAuthService.RegistrationResult result = patientAuthService.register(
                new PatientAuthService.RegisterAccountCommand(request.firstName(), request.lastName(),
                        request.idNumber(), request.address(), request.contactNumber(), request.email(),
                        request.password()));
        return ResponseEntity.ok(new AuthResponse(result.token().token(), result.token().expiresAt().toString(),
                toSummary(result.account())));
    }

    @PostMapping("/auth/login")
    public ResponseEntity<AuthResponse> login(@Valid @RequestBody LoginRequest request) {
        PatientJwtService.IssuedToken issued = patientAuthService.login(request.email(), request.password());
        PatientAccount account = patientAccountRepository.findByEmail(request.email()).orElseThrow();
        return ResponseEntity.ok(new AuthResponse(issued.token(), issued.expiresAt().toString(), toSummary(account)));
    }

    // Same rehydration role as AuthController.me()/PlatformAuthController's
    // equivalent — the frontend's PatientAuthContext calls this on every
    // fresh page load to reconstruct a still-valid session.
    @GetMapping("/auth/me")
    public ResponseEntity<PatientAccountSummary> me(@AuthenticationPrincipal PatientPrincipal principal) {
        PatientAccount account = patientAccountRepository.findById(principal.patientAccountId()).orElseThrow();
        return ResponseEntity.ok(toSummary(account));
    }

    @PostMapping("/auth/logout")
    public ResponseEntity<Void> logout() {
        patientAuthService.logout();
        return ResponseEntity.noContent().build();
    }

    private static PatientAccountSummary toSummary(PatientAccount account) {
        return new PatientAccountSummary(account.getId(), account.getEmail(), account.getFirstName(),
                account.getLastName(), account.getPatientId() != null);
    }

    public record RegisterRequest(
            @NotBlank @Size(max = 100) String firstName, @NotBlank @Size(max = 100) String lastName,
            @NotBlank @Pattern(regexp = "^\\d{13}$", message = "Enter a valid 13-digit SA ID number") String idNumber,
            @NotBlank @Size(max = 300) String address,
            @NotBlank @Pattern(regexp = "^\\+?[0-9]{9,15}$") String contactNumber,
            @NotBlank @Email String email, @NotBlank @Size(min = 8, max = 100) String password) {
    }

    public record LoginRequest(@NotBlank @Email String email, @NotBlank String password) {
    }

    public record AuthResponse(String accessToken, String expiresAt, PatientAccountSummary account) {
    }

    public record PatientAccountSummary(UUID id, String email, String firstName, String lastName, boolean linked) {
    }
}
