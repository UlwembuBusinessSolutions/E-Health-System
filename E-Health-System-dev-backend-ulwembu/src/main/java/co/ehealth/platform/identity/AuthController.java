package co.ehealth.platform.identity;

import co.ehealth.platform.core.security.AuthenticatedPrincipal;
import co.ehealth.platform.core.security.JwtService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {

    private final AuthService authService;
    private final PasswordResetService passwordResetService;
    private final UserRepository userRepository;
    private final StaffService staffService;

    public AuthController(AuthService authService, PasswordResetService passwordResetService,
                           UserRepository userRepository, StaffService staffService) {
        this.authService = authService;
        this.passwordResetService = passwordResetService;
        this.userRepository = userRepository;
        this.staffService = staffService;
    }

    @PostMapping("/login")
    public ResponseEntity<LoginResponse> login(@Valid @RequestBody LoginRequest request) {
        JwtService.IssuedToken issued = authService.login(request.email(), request.password());
        User user = userRepository.findByEmail(request.email()).orElseThrow();
        StaffService.LicenseStatus licenseStatus = staffService.getLicenseStatus(user.getId());
        return ResponseEntity.ok(new LoginResponse(issued.token(), issued.expiresAt().toString(),
                new UserSummary(user.getId(), user.getEmail(), user.getFirstName(), user.getLastName(),
                        licenseStatus.canPrescribe(), licenseStatus.canDispense())));
    }

    @PostMapping("/logout")
    public ResponseEntity<Void> logout(@AuthenticationPrincipal AuthenticatedPrincipal principal) {
        authService.logout(principal.jti());
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/unlock")
    public ResponseEntity<Void> unlock(@AuthenticationPrincipal AuthenticatedPrincipal principal,
                                        @Valid @RequestBody UnlockRequest request) {
        authService.unlock(principal.userId(), principal.jti(), request.password());
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/password-reset/request")
    public ResponseEntity<Void> requestPasswordReset(@Valid @RequestBody PasswordResetRequestBody request,
                                                       HttpServletRequest httpRequest) {
        passwordResetService.requestReset(request.email(), httpRequest.getRemoteAddr());
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/password-reset/confirm")
    public ResponseEntity<Void> confirmPasswordReset(@Valid @RequestBody PasswordResetConfirmBody request) {
        passwordResetService.confirmReset(request.email(), request.code(), request.newPassword());
        return ResponseEntity.noContent().build();
    }

    public record LoginRequest(@NotBlank @Email String email, @NotBlank String password) {
    }

    public record LoginResponse(String accessToken, String expiresAt, UserSummary user) {
    }

    // The UI receives the current action capabilities explicitly, rather
    // than reverse-engineering them from sensitive registration numbers.
    // PrescriptionService independently enforces these same capabilities on
    // every request, so a stale client response can never grant API access.
    public record UserSummary(UUID id, String email, String firstName, String lastName,
                              boolean canPrescribe, boolean canDispense) {
    }

    public record UnlockRequest(@NotBlank String password) {
    }

    public record PasswordResetRequestBody(@NotBlank @Email String email) {
    }

    public record PasswordResetConfirmBody(
            @NotBlank @Email String email, @NotBlank String code, @NotBlank String newPassword) {
    }
}
