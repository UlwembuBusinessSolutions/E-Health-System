package co.ehealth.platform.identity.mfa;

import co.ehealth.platform.core.security.AuthenticatedPrincipal;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

@RestController
public class MfaAdminController {
    private final MfaAdminService service;

    public MfaAdminController(MfaAdminService service) {
        this.service = service;
    }

    @GetMapping("/api/v1/admin/mfa/policies")
    public Map<String, Object> list() {
        return Map.of("items", service.listPolicies());
    }

    @PutMapping("/api/v1/admin/mfa/policies/{roleId}")
    public MfaAdminService.PolicyView set(@PathVariable UUID roleId, @Valid @RequestBody PolicyRequest r,
            @AuthenticationPrincipal AuthenticatedPrincipal admin) {
        return service.setPolicy(roleId, r.policy(), admin.userId());
    }

    @PostMapping("/api/v1/admin/staff/{id}/mfa/reset")
    public ResponseEntity<Void> reset(@PathVariable UUID id, @AuthenticationPrincipal AuthenticatedPrincipal admin) {
        service.resetUserMfa(id, admin.userId(), null);
        return ResponseEntity.noContent().build();
    }

    public record PolicyRequest(@NotNull MfaPolicy policy) {
    }
}