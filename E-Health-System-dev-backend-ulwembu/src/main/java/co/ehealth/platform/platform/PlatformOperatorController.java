package co.ehealth.platform.platform;

import co.ehealth.platform.core.security.PlatformOperatorPrincipal;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
<<<<<<< HEAD:E-Health-System-dev-backend-ulwembu/src/main/java/co/ehealth/platform/platform/PlatformOperatorController.java
import org.springframework.web.bind.annotation.DeleteMapping;
=======
>>>>>>> origin/dev-backend-ulwembu:src/main/java/co/ehealth/platform/platform/PlatformOperatorController.java
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;
import java.util.UUID;

// SecurityConfig already requires hasRole("PLATFORM_OPERATOR") for
// everything under /platform/** — creating a new operator is itself an
// operator-only action, so that's the whole authorization check; nothing
// tenant-scoped can ever reach this controller in the first place.
@RestController
@RequestMapping("/platform/operators")
public class PlatformOperatorController {

    private final PlatformOperatorService platformOperatorService;

    public PlatformOperatorController(PlatformOperatorService platformOperatorService) {
        this.platformOperatorService = platformOperatorService;
    }

    // Matches PlatformController.list()'s { items: [...] } envelope shape
    // for the same list-endpoint consistency reason.
    @GetMapping
    public ResponseEntity<Map<String, Object>> list() {
        List<PlatformOperatorService.OperatorSummary> items = platformOperatorService.listOperators();
        return ResponseEntity.ok(Map.of("items", items));
    }

    @PostMapping
    public ResponseEntity<PlatformOperatorService.CreatedOperator> create(
            @Valid @RequestBody CreateOperatorRequest request,
            @AuthenticationPrincipal PlatformOperatorPrincipal operator) {
        var command = new PlatformOperatorService.CreateOperatorCommand(
                request.firstName(), request.lastName(), request.email());
        var created = platformOperatorService.createOperator(command, operator.operatorId());
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    public record CreateOperatorRequest(
            @NotBlank String firstName, @NotBlank String lastName, @NotBlank @Email String email) {
    }

    // Any operator can reset any other operator's password — there's no
    // finer-grained role than PLATFORM_OPERATOR today, same "one internal
    // team, one trust level" reasoning as every other /platform/** endpoint.
    @PostMapping("/{id}/reset-password")
    public ResponseEntity<ResetPasswordResponse> resetPassword(
            @PathVariable UUID id, @AuthenticationPrincipal PlatformOperatorPrincipal operator) {
        String temporaryPassword = platformOperatorService.resetPassword(id, operator.operatorId());
        return ResponseEntity.ok(new ResetPasswordResponse(temporaryPassword));
    }

    @PostMapping("/{id}/enable")
    public ResponseEntity<Void> enable(@PathVariable UUID id,
                                        @AuthenticationPrincipal PlatformOperatorPrincipal operator) {
        platformOperatorService.setEnabled(id, true, operator.operatorId());
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/disable")
    public ResponseEntity<Void> disable(@PathVariable UUID id,
                                         @AuthenticationPrincipal PlatformOperatorPrincipal operator) {
        platformOperatorService.setEnabled(id, false, operator.operatorId());
        return ResponseEntity.noContent().build();
    }

<<<<<<< HEAD:E-Health-System-dev-backend-ulwembu/src/main/java/co/ehealth/platform/platform/PlatformOperatorController.java
    // Distinct from enable()/disable() above — see PlatformOperatorService.unlock()'s
    // own why-note on why LOCKED needs its own lever rather than reusing
    // setEnabled().
    @PostMapping("/{id}/unlock")
    public ResponseEntity<Void> unlock(@PathVariable UUID id,
                                        @AuthenticationPrincipal PlatformOperatorPrincipal operator) {
        platformOperatorService.unlock(id, operator.operatorId());
        return ResponseEntity.noContent().build();
    }

    // Permanent removal — see PlatformOperatorService.delete()'s own
    // why-note on why this is separate from disable() and why an operator
    // with audit history can't actually be removed this way.
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable UUID id,
                                        @AuthenticationPrincipal PlatformOperatorPrincipal operator) {
        platformOperatorService.delete(id, operator.operatorId());
        return ResponseEntity.noContent().build();
    }

=======
>>>>>>> origin/dev-backend-ulwembu:src/main/java/co/ehealth/platform/platform/PlatformOperatorController.java
    // temporaryPassword returned exactly once — same discipline as
    // CreatedOperator above.
    public record ResetPasswordResponse(String temporaryPassword) {
    }
}
