package co.ehealth.platform.patient;

import co.ehealth.platform.core.security.PatientJwtService;
import co.ehealth.platform.core.security.PatientPrincipal;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import jakarta.validation.constraints.Email;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

// The patient portal has its own authentication surface, including the public registration and email confirmation steps.
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
    public ResponseEntity<RegistrationStartedResponse> register(@Valid @RequestBody RegisterRequest request) {
        PatientAuthService.RegistrationStarted result = patientAuthService.register(
                new PatientAuthService.RegisterAccountCommand(request.firstName(), request.lastName(),
                        request.idNumber(), request.address(), request.contactNumber(), request.email(),
                        request.password()));
        return ResponseEntity.ok(new RegistrationStartedResponse(true, result.email(), result.expiresInMinutes()));
    }

    @PostMapping("/verify-email")
    public ResponseEntity<AuthResponse> verifyEmail(@Valid @RequestBody VerifyEmailRequest request) {
        PatientAuthService.RegistrationResult result = patientAuthService.verifyRegistration(
                request.email(), request.code());
        return ResponseEntity.ok(new AuthResponse(result.token().token(), result.token().expiresAt().toString(),
                toSummary(result.account())));
    }

    @PostMapping("/auth/login")
    public ResponseEntity<AuthResponse> login(@Valid @RequestBody LoginRequest request) {
        PatientJwtService.IssuedToken issued = patientAuthService.login(request.identifier(), request.password());
        PatientAccount account = patientAuthService.accountForLogin(request.identifier());
        return ResponseEntity.ok(new AuthResponse(issued.token(), issued.expiresAt().toString(), toSummary(account)));
    }

    @PostMapping("/auth/password-reset/request")
    public ResponseEntity<Void> requestPasswordReset(@Valid @RequestBody PatientPasswordResetRequest request,
                                                        jakarta.servlet.http.HttpServletRequest httpRequest) {
        patientAuthService.requestPasswordReset(request.identifier(), httpRequest.getRemoteAddr());
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/auth/password-reset/confirm")
    public ResponseEntity<Void> confirmPasswordReset(@Valid @RequestBody PatientPasswordResetConfirm request) {
        patientAuthService.confirmPasswordReset(request.identifier(), request.code(), request.newPassword());
        return ResponseEntity.noContent().build();
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

    public record LoginRequest(@NotBlank @Size(max = 255) String identifier, @NotBlank String password) { }

    public record PatientPasswordResetRequest(@NotBlank @Size(max = 255) String identifier) { }

    public record PatientPasswordResetConfirm(@NotBlank @Size(max = 255) String identifier,
                                              @NotBlank @Pattern(regexp = "^\\d{6}$") String code,
                                              @NotBlank @Size(min = 8, max = 100) String newPassword) { }

    public record VerifyEmailRequest(@NotBlank @Email String email,
                                     @NotBlank @Pattern(regexp = "^\\d{6}$") String code) {
    }

    public record RegistrationStartedResponse(boolean verificationRequired, String email, long expiresInMinutes) {
    }

    public record AuthResponse(String accessToken, String expiresAt, PatientAccountSummary account) {
    }

    public record PatientAccountSummary(UUID id, String email, String firstName, String lastName, boolean linked) {
    }
}
