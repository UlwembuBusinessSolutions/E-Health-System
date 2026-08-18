package co.ehealth.platform.platform;

import co.ehealth.platform.core.security.PlatformOperatorPrincipal;
import co.ehealth.platform.core.tenant.ModuleCode;
import co.ehealth.platform.core.tenant.Organization;
import co.ehealth.platform.core.tenant.OrganizationStatus;
import co.ehealth.platform.identity.Gender;
import co.ehealth.platform.identity.StaffService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/platform/organizations")
public class PlatformController {

    private final OrganizationProvisioningService provisioningService;

    public PlatformController(OrganizationProvisioningService provisioningService) {
        this.provisioningService = provisioningService;
    }

    @GetMapping
    public ResponseEntity<Map<String, Object>> list(
            @RequestParam(required = false) String q,
            @RequestParam(required = false) OrganizationStatus status,
            @RequestParam(required = false, defaultValue = "newest") String sort) {
        boolean oldestFirst = "oldest".equalsIgnoreCase(sort);
        var items = provisioningService.listOrganizations(q, status, oldestFirst).stream()
                .map(OrganizationSummary::from).toList();
        return ResponseEntity.ok(Map.of("items", items));
    }

    @GetMapping("/{id}")
    public ResponseEntity<OrganizationSummary> get(@PathVariable UUID id) {
        return ResponseEntity.ok(OrganizationSummary.from(provisioningService.getOrganization(id)));
    }

    @PostMapping
    public ResponseEntity<OrganizationProvisioningService.ProvisionedOrganization> create(
            @Valid @RequestBody ProvisionOrganizationRequest request,
            @AuthenticationPrincipal PlatformOperatorPrincipal operator) {
        var command = new OrganizationProvisioningService.ProvisionOrganizationCommand(
                request.slug(), request.displayName(), request.admins().stream().map(AdminRequest::toInput).toList());
        var result = provisioningService.provisionOrganization(command, operator.operatorId());
        return ResponseEntity.status(HttpStatus.CREATED).body(result);
    }

    @PostMapping("/{id}/admins")
    public ResponseEntity<OrganizationProvisioningService.ProvisionedOrganization> addAdmins(
            @PathVariable UUID id, @Valid @RequestBody AddAdminsRequest request,
            @AuthenticationPrincipal PlatformOperatorPrincipal operator) {
        var command = new OrganizationProvisioningService.AddAdminsCommand(
                request.admins().stream().map(AdminRequest::toInput).toList());
        var result = provisioningService.addAdmins(id, command, operator.operatorId());
        return ResponseEntity.status(HttpStatus.CREATED).body(result);
    }

    @GetMapping("/{id}/admins")
    public ResponseEntity<Map<String, Object>> listAdmins(@PathVariable UUID id) {
        List<StaffService.AdminSummary> admins = provisioningService.listAdmins(id);
        return ResponseEntity.ok(Map.of("items", admins));
    }

    @DeleteMapping("/{id}/admins/{userId}")
    public ResponseEntity<Void> removeAdmin(@PathVariable UUID id, @PathVariable UUID userId,
                                            @AuthenticationPrincipal PlatformOperatorPrincipal operator) {
        provisioningService.removeAdmin(id, userId, operator.operatorId());
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/suspend")
    public ResponseEntity<Void> suspend(@PathVariable UUID id,
                                        @AuthenticationPrincipal PlatformOperatorPrincipal operator) {
        provisioningService.suspend(id, operator.operatorId());
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/reactivate")
    public ResponseEntity<Void> reactivate(@PathVariable UUID id,
                                           @AuthenticationPrincipal PlatformOperatorPrincipal operator) {
        provisioningService.reactivate(id, operator.operatorId());
        return ResponseEntity.noContent().build();
    }

    // 🆕 Correct placement of module endpoints
    @PostMapping("/{id}/modules/{moduleCode}/enable")
    public ResponseEntity<Void> enableModule(@PathVariable UUID id, @PathVariable ModuleCode moduleCode,
                                             @AuthenticationPrincipal PlatformOperatorPrincipal operator) {
        provisioningService.setModuleEnabled(id, moduleCode, true, operator.operatorId());
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{id}/modules")
    public ResponseEntity<Map<String, Object>> listModules(@PathVariable UUID id) {
        return ResponseEntity.ok(Map.of("items", provisioningService.listModuleStates(id)));
    }

    @PostMapping("/{id}/modules/{moduleCode}/disable")
    public ResponseEntity<Void> disableModule(@PathVariable UUID id, @PathVariable ModuleCode moduleCode,
                                              @AuthenticationPrincipal PlatformOperatorPrincipal operator) {
        provisioningService.setModuleEnabled(id, moduleCode, false, operator.operatorId());
        return ResponseEntity.noContent().build();
    }

    // --- Request/Response records ---
    public record ProvisionOrganizationRequest(
            @NotBlank @Pattern(regexp = "^[a-z][a-z0-9-]{1,61}[a-z0-9]$") String slug,
            @NotBlank String displayName,
            @NotEmpty List<@Valid AdminRequest> admins) {
    }

    public record AddAdminsRequest(@NotEmpty List<@Valid AdminRequest> admins) {
    }

    public record AdminRequest(
            @NotBlank String firstName, @NotBlank String lastName,
            @NotBlank String employeeNumber, @NotBlank @Email String email,
            @NotBlank @Pattern(regexp = "^\\+?[0-9]{9,15}$") String contactNumber,
            @NotNull Gender gender) {
        OrganizationProvisioningService.AdminInput toInput() {
            return new OrganizationProvisioningService.AdminInput(
                    firstName, lastName, employeeNumber, email, contactNumber, gender);
        }
    }

    public record OrganizationSummary(UUID id, String slug, String displayName,
                                      OrganizationStatus status, Instant createdAt) {
        static OrganizationSummary from(Organization o) {
            return new OrganizationSummary(o.getId(), o.getSlug(), o.getDisplayName(),
                    o.getStatus(), o.getCreatedAt());
        }
    }
}
