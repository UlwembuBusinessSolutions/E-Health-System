package co.ehealth.platform.platform;

import co.ehealth.platform.core.security.PlatformOperatorPrincipal;
import co.ehealth.platform.core.tenant.Organization;
import co.ehealth.platform.core.tenant.OrganizationStatus;
import co.ehealth.platform.identity.Gender;
import co.ehealth.platform.identity.StaffService;
import co.ehealth.platform.platform.PlatformController.AdminRequest;
import co.ehealth.platform.platform.PlatformController.OrganizationSummary;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import co.ehealth.platform.core.tenant.SectorType;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

// @AuthenticationPrincipal PlatformOperatorPrincipal on every mutating
// endpoint below — every write knows exactly which platform operator made
// it, and platform_audit_log actually records that.
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

    // admins takes one or more — a client's real rollout is rarely a
    // single person, so provisioning supports handing every initial admin
    // their own account in the same call rather than forcing a
    // provision-then-addAdmins round trip for anyone past the first.
    @PostMapping
    public ResponseEntity<OrganizationProvisioningService.ProvisionedOrganization> create(
            @Valid @RequestBody ProvisionOrganizationRequest request,
            @AuthenticationPrincipal PlatformOperatorPrincipal operator) {
        var command = new OrganizationProvisioningService.ProvisionOrganizationCommand(
                request.slug(), request.displayName(), request.sectorType(),
                request.admins().stream().map(AdminRequest::toInput).toList());
        var result = provisioningService.provisionOrganization(command, operator.operatorId());
        return ResponseEntity.status(HttpStatus.CREATED).body(result);
    }

    // The fix for "client's only admin is locked out / left / wants more
    // admins added by us, not by themselves" — run by the platform team
    // rather than by an admin that org already has. Also takes a list, for
    // the same reason provisioning does.
    @PostMapping("/{id}/admins")
    public ResponseEntity<OrganizationProvisioningService.ProvisionedOrganization> addAdmins(
            @PathVariable UUID id, @Valid @RequestBody AddAdminsRequest request,
            @AuthenticationPrincipal PlatformOperatorPrincipal operator) {
        var command = new OrganizationProvisioningService.AddAdminsCommand(
                request.admins().stream().map(AdminRequest::toInput).toList());
        var result = provisioningService.addAdmins(id, command, operator.operatorId());
        return ResponseEntity.status(HttpStatus.CREATED).body(result);
    }

    // The read half of the same gap addAdmins fixes the write half of —
    // until now there was no way to see who currently holds ORG_ADMIN for
    // a given org without direct database access.
    @GetMapping("/{id}/admins")
    public ResponseEntity<Map<String, Object>> listAdmins(@PathVariable UUID id) {
        List<StaffService.AdminSummary> admins = provisioningService.listAdmins(id);
        return ResponseEntity.ok(Map.of("items", admins));
    }

    // The actual fix for "an admin is locked out or has left, and nobody
    // else has platform access to remove them" — revokes ORG_ADMIN only,
    // doesn't touch the account otherwise (StaffService.revokeOrgAdminRole()'s
    // own why-note). Refuses to remove an org's last remaining admin
    // (LastRemainingAdminException, 409) — every path back to having one
    // requires already being one.
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

    // public record ProvisionOrganizationRequest(
    // @NotBlank @Pattern(regexp = "^[a-z][a-z0-9-]{1,61}[a-z0-9]$") String slug,
    // @NotBlank String displayName,
    // @NotEmpty List<@Valid AdminRequest> admins) {
    // }

    public record ProvisionOrganizationRequest(
            @NotBlank @Pattern(regexp = "^[a-z][a-z0-9-]{1,61}[a-z0-9]$") String slug,
            @NotBlank String displayName,
            SectorType sectorType,
            @NotEmpty List<@Valid AdminRequest> admins) {
    }

    public record AddAdminsRequest(@NotEmpty List<@Valid AdminRequest> admins) {
    }

    // One admin's details, shared by both request shapes above.
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

    // public record OrganizationSummary(UUID id, String slug, String displayName,
    // OrganizationStatus status,
    // Instant createdAt) {
    // static OrganizationSummary from(Organization o) {
    // return new OrganizationSummary(o.getId(), o.getSlug(), o.getDisplayName(),
    // o.getStatus(),
    // o.getCreatedAt());
    // }
    // }

    public record OrganizationSummary(UUID id, String slug, String displayName, OrganizationStatus status,
            SectorType sectorType, Instant createdAt) {
        static OrganizationSummary from(Organization o) {
            return new OrganizationSummary(o.getId(), o.getSlug(), o.getDisplayName(), o.getStatus(),
                    o.getSectorType(), o.getCreatedAt());
        }
    }
}
