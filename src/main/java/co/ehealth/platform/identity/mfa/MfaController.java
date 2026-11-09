package co.ehealth.platform.identity.mfa;

import co.ehealth.platform.core.security.AuthenticatedPrincipal;
import co.ehealth.platform.identity.AuthController.LoginResponse;
import co.ehealth.platform.identity.AuthController.UserSummary;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/auth/mfa")
public class MfaController {

    private final MfaFlowService flow;

    public MfaController(MfaFlowService flow) {
        this.flow = flow;
    }

    // ---- permitAll (challenge-token authenticated) ----
    @PostMapping("/verify")
    public ResponseEntity<LoginResponse> verify(@Valid @RequestBody VerifyRequest r) {
        return ResponseEntity.ok(toResponse(flow.verifyLogin(r.challengeToken(), r.code(), r.recoveryCode())));
    }

    @PostMapping("/enrol/start")
    public ResponseEntity<MfaService.EnrolmentSecret> enrolStart(@Valid @RequestBody ChallengeRequest r) {
        return ResponseEntity.ok(flow.startChallengeEnrolment(r.challengeToken()));
    }

    @PostMapping("/enrol/confirm")
    public ResponseEntity<LoginResponse> enrolConfirm(@Valid @RequestBody ConfirmRequest r) {
        return ResponseEntity.ok(toResponse(flow.confirmChallengeEnrolment(r.challengeToken(), r.code())));
    }

    // ---- authenticated ----
    @GetMapping("/status")
    public MfaFlowService.Status status(@AuthenticationPrincipal AuthenticatedPrincipal p) {
        return flow.status(p.userId());
    }

    @PostMapping("/setup")
    public MfaService.EnrolmentSecret setup(@AuthenticationPrincipal AuthenticatedPrincipal p) {
        return flow.startSelfEnrolment(p.userId());
    }

    @PostMapping("/setup/confirm")
    public Map<String, List<String>> setupConfirm(@AuthenticationPrincipal AuthenticatedPrincipal p,
            @Valid @RequestBody CodeRequest r) {
        return Map.of("recoveryCodes", flow.confirmSelfEnrolment(p.userId(), r.code()));
    }

    @PostMapping("/recovery-codes/regenerate")
    public Map<String, List<String>> regenerate(@AuthenticationPrincipal AuthenticatedPrincipal p,
            @Valid @RequestBody CodeRequest r) {
        return Map.of("recoveryCodes", flow.regenerateRecoveryCodes(p.userId(), r.code()));
    }

    @PostMapping("/disable")
    public ResponseEntity<Void> disable(@AuthenticationPrincipal AuthenticatedPrincipal p,
            @Valid @RequestBody DisableRequest r) {
        flow.disable(p.userId(), r.password(), r.code());
        return ResponseEntity.noContent().build();
    }

    private static LoginResponse toResponse(MfaFlowService.Completed c) {
        var u = c.user();
        return new LoginResponse(c.token().token(), c.token().expiresAt().toString(),
                new UserSummary(u.getId(), u.getEmail(), u.getFirstName(), u.getLastName()),
                false, false, null, null, c.recoveryCodes(), c.recoveryCodesRemaining());
    }

    public record ChallengeRequest(@NotBlank String challengeToken) {
    }

    public record VerifyRequest(@NotBlank String challengeToken, @Size(max = 20) String code,
            @Size(max = 30) String recoveryCode) {
    }

    public record ConfirmRequest(@NotBlank String challengeToken, @NotBlank @Size(max = 20) String code) {
    }

    public record CodeRequest(@NotBlank @Size(max = 20) String code) {
    }

    public record DisableRequest(@NotBlank String password, @NotBlank @Size(max = 20) String code) {
    }
}