package co.ehealth.platform.identity;

import co.ehealth.platform.core.audit.AuditLogService;
import co.ehealth.platform.core.clinic.ClinicContext;
import co.ehealth.platform.core.security.AuthenticatedPrincipal;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.UUID;

@RestController
public class ClinicScopeController {
    private final ClinicScopeService scopes;
    private final AuditLogService audit;

    public ClinicScopeController(ClinicScopeService scopes, AuditLogService audit) {
        this.scopes = scopes;
        this.audit = audit;
    }

    @GetMapping("/api/v1/auth/clinic-context")
    public ContextView current(@AuthenticationPrincipal AuthenticatedPrincipal principal) {
        return new ContextView(ClinicContext.get(), scopes.accessibleClinics(principal.userId()));
    }

    // The client sends the selected clinic in X-Clinic-ID on this and subsequent requests.
    @PutMapping("/api/v1/auth/clinic-context")
    public ContextView switchContext(@AuthenticationPrincipal AuthenticatedPrincipal principal) {
        UUID clinic = ClinicContext.require();
        audit.append(principal.userId(), clinic, "CLINIC_CONTEXT_SELECTED", "Facility", clinic.toString(), null, null);
        return current(principal);
    }

    @PutMapping("/api/v1/admin/staff/{userId}/clinics")
    public ContextView assign(@PathVariable UUID userId, @Valid @RequestBody AssignmentRequest request) {
        return new ContextView(request.primaryClinicId(),
                scopes.replaceAssignments(userId, request.clinicIds(), request.primaryClinicId()));
    }

    @GetMapping("/api/v1/admin/staff/{userId}/clinics")
    public ClinicScopeService.AssignmentView assignments(@PathVariable UUID userId) {
        return scopes.assignments(userId);
    }

    public record AssignmentRequest(@NotEmpty List<@NotNull UUID> clinicIds, @NotNull UUID primaryClinicId) { }
    public record ContextView(UUID activeClinicId, List<UUID> clinicIds) { }
}
