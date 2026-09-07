package co.ehealth.platform.platform;

import co.ehealth.platform.core.security.PlatformOperatorPrincipal;
import co.ehealth.platform.core.tenant.ModuleCode;
import co.ehealth.platform.core.tenant.Organization;
import co.ehealth.platform.core.tenant.OrganizationSector;
import co.ehealth.platform.core.tenant.OrganizationStatus;
import co.ehealth.platform.facility.Facility;
import co.ehealth.platform.facility.FacilityType;
import co.ehealth.platform.identity.Gender;
import co.ehealth.platform.identity.StaffService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

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
        List<Organization> organizations = provisioningService.listOrganizations(q, status, oldestFirst);
        Map<UUID, Integer> moduleCounts = provisioningService
                .countEnabledModules(organizations.stream().map(Organization::getId).toList());
        var items = organizations.stream()
                .map(org -> OrganizationSummary.from(org, moduleCounts.get(org.getId()))).toList();
        return ResponseEntity.ok(Map.of("items", items));
    }

    @GetMapping("/{id}")
    public ResponseEntity<OrganizationSummary> get(@PathVariable UUID id) {
        Organization organization = provisioningService.getOrganization(id);
        int enabledModules = provisioningService.countEnabledModules(List.of(id)).get(id);
        return ResponseEntity.ok(OrganizationSummary.from(organization, enabledModules));
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
                request.slug(), request.displayName(), request.sector(),
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

    // The other half of "an admin is locked out" — sometimes the fix isn't
    // removing them, it's giving them back in. Same reasoning as
    // removeAdmin() above, routed the same way.
    @PostMapping("/{id}/admins/{userId}/reset-password")
    public ResponseEntity<AdminResetPasswordResponse> resetAdminPassword(
            @PathVariable UUID id, @PathVariable UUID userId,
            @AuthenticationPrincipal PlatformOperatorPrincipal operator) {
        String temporaryPassword = provisioningService.resetAdminPassword(id, userId, operator.operatorId());
        return ResponseEntity.ok(new AdminResetPasswordResponse(temporaryPassword));
    }

    @PostMapping("/{id}/admins/{userId}/enable")
    public ResponseEntity<Void> enableAdmin(@PathVariable UUID id, @PathVariable UUID userId,
                                             @AuthenticationPrincipal PlatformOperatorPrincipal operator) {
        provisioningService.setAdminEnabled(id, userId, true, operator.operatorId());
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/admins/{userId}/disable")
    public ResponseEntity<Void> disableAdmin(@PathVariable UUID id, @PathVariable UUID userId,
                                              @AuthenticationPrincipal PlatformOperatorPrincipal operator) {
        provisioningService.setAdminEnabled(id, userId, false, operator.operatorId());
        return ResponseEntity.noContent().build();
    }

    // Distinct from enable/disable above — see StaffController.unlock()'s
    // own why-note on why LOCKED needs its own lever.
    @PostMapping("/{id}/admins/{userId}/unlock")
    public ResponseEntity<Void> unlockAdmin(@PathVariable UUID id, @PathVariable UUID userId,
                                             @AuthenticationPrincipal PlatformOperatorPrincipal operator) {
        provisioningService.unlockAdmin(id, userId, operator.operatorId());
        return ResponseEntity.noContent().build();
    }

    // temporaryPassword returned exactly once — same discipline as every
    // other password-exposing response in this controller.
    public record AdminResetPasswordResponse(String temporaryPassword) {
    }

    // The one properly RESTful "edit this resource" endpoint in this
    // controller — everything else here is action-shaped (POST .../suspend,
    // POST .../modules/{code}) because that's what those operations
    // actually are (state transitions, toggles), but changing the name and
    // sector genuinely is just updating fields on the resource. slug is
    // deliberately absent from the request body — see Organization.rename()'s
    // own why-note for why that one stays permanent.
    @PatchMapping("/{id}")
    public ResponseEntity<OrganizationSummary> updateDetails(@PathVariable UUID id,
                                                               @Valid @RequestBody UpdateOrganizationRequest request,
                                                               @AuthenticationPrincipal PlatformOperatorPrincipal operator) {
        provisioningService.updateDetails(id, request.displayName(), request.sector(), operator.operatorId());
        Organization organization = provisioningService.getOrganization(id);
        int enabledModules = provisioningService.countEnabledModules(List.of(id)).get(id);
        return ResponseEntity.ok(OrganizationSummary.from(organization, enabledModules));
    }

    public record UpdateOrganizationRequest(@NotBlank String displayName, @NotNull OrganizationSector sector) {
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

    // Multipart, not JSON — same reasoning as OrganizationBrandingController's
    // own upload endpoint: file-type validation happens inside the service,
    // nothing here for Bean Validation to attach to on a MultipartFile
    // parameter. Not folded into create() above: provisioning already takes
    // one JSON body, and a brand-new org has no id for a file to be
    // associated with until that call returns — this is always a follow-up,
    // same shape as staff creation then a separate photo upload.
    @PostMapping(value = "/{id}/logo", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<LogoUploadResponse> uploadLogo(@PathVariable UUID id,
                                                          @RequestParam("file") MultipartFile file,
                                                          @AuthenticationPrincipal PlatformOperatorPrincipal operator) {
        String url = provisioningService.uploadLogo(id, file, operator.operatorId());
        return ResponseEntity.ok(new LogoUploadResponse(url));
    }

    public record LogoUploadResponse(String logoUrl) {
    }

    // AUDT-US-005/006's platform-side entry point — one organization's own
    // audit trail, viewed by a platform operator rather than that org's own
    // staff. No filters here (unlike GET /platform/audit) — see
    // OrganizationProvisioningService.listTenantAuditLog()'s own why-note.
    @GetMapping("/{id}/audit")
    public ResponseEntity<Map<String, Object>> listTenantAudit(@PathVariable UUID id) {
        return ResponseEntity.ok(Map.of("items", provisioningService.listTenantAuditLog(id)));
    }

    // SADM-US-006 — a platform operator adding a clinic to a tenant, from
    // the platform console rather than that tenant's own ORG_ADMIN self-
    // service form (FacilityController's own /api/v1/facilities, which
    // needs a tenant-scoped session this controller's callers don't have).
    @PostMapping("/{id}/facilities")
    public ResponseEntity<FacilityResponse> addClinic(@PathVariable UUID id,
                                                        @Valid @RequestBody AddClinicRequest request,
                                                        @AuthenticationPrincipal PlatformOperatorPrincipal operator) {
        var command = new OrganizationProvisioningService.AddClinicCommand(
                request.name(), request.code(), request.type(), request.address(), request.phone(),
                request.operatingHours());
        Facility facility = provisioningService.addClinic(id, command, operator.operatorId());
        return ResponseEntity.status(HttpStatus.CREATED).body(FacilityResponse.from(facility));
    }

    // The read half — this organization's whole facility network, active
    // and inactive alike (FacilityService.list()'s own why-note on why that
    // differs from the tenant-side staff-creation dropdown).
    @GetMapping("/{id}/facilities")
    public ResponseEntity<Map<String, Object>> listClinics(@PathVariable UUID id) {
        List<FacilityResponse> items = provisioningService.listClinics(id).stream()
                .map(FacilityResponse::from).toList();
        return ResponseEntity.ok(Map.of("items", items));
    }

    public record AddClinicRequest(
            @NotBlank String name, @NotBlank @Pattern(regexp = "^[A-Za-z0-9-]{1,20}$") String code,
            @NotNull FacilityType type, String address, String phone, String operatingHours) {
    }

    public record FacilityResponse(UUID id, String name, String code, FacilityType type, String address,
                                    String phone, String operatingHours, boolean active) {
        static FacilityResponse from(Facility f) {
            return new FacilityResponse(f.getId(), f.getName(), f.getCode(), f.getType(), f.getAddress(),
                    f.getPhone(), f.getOperatingHours(), f.isActive());
        }
    }

    // SADM-US-010. All 20 modules, not just the ones this org has an
    // opinion about — see OrganizationProvisioningService.listModuleEntitlements()'s
    // own why-note on what an absent row means.
    @GetMapping("/{id}/modules")
    public ResponseEntity<Map<String, Object>> listModules(@PathVariable UUID id) {
        return ResponseEntity.ok(Map.of("items", provisioningService.listModuleEntitlements(id)));
    }

    // {moduleCode} binds straight to the enum (Spring's default enum
    // converter, case-sensitive against ModuleCode's own constant names) —
    // an unrecognised code 400s before this method body ever runs, same as
    // any other malformed path variable.
    @PostMapping("/{id}/modules/{moduleCode}")
    public ResponseEntity<Void> toggleModule(@PathVariable UUID id, @PathVariable ModuleCode moduleCode,
                                              @Valid @RequestBody ToggleModuleRequest request,
                                              @AuthenticationPrincipal PlatformOperatorPrincipal operator) {
        provisioningService.toggleModule(id, moduleCode, request.enabled(), operator.operatorId());
        return ResponseEntity.noContent().build();
    }

    public record ToggleModuleRequest(@NotNull Boolean enabled) {
    }

    public record ProvisionOrganizationRequest(
            @NotBlank @Pattern(regexp = "^[a-z][a-z0-9-]{1,61}[a-z0-9]$") String slug,
            @NotBlank String displayName,
            @NotNull OrganizationSector sector,
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

    // enabledModuleCount/totalModuleCount back the org list's "Modules"
    // column (SADM-US-010, matching the eHealth Prototype's own
    // organisations table) — totalModuleCount rides along on every summary
    // rather than being a frontend constant, so the catalogue only has one
    // source of truth (ModuleCode) instead of two places that could drift.
    public record OrganizationSummary(UUID id, String slug, String displayName, OrganizationStatus status,
                                       OrganizationSector sector, String logoUrl, Instant createdAt,
                                       int enabledModuleCount, int totalModuleCount) {
        static OrganizationSummary from(Organization o, int enabledModuleCount) {
            return new OrganizationSummary(o.getId(), o.getSlug(), o.getDisplayName(), o.getStatus(), o.getSector(),
                    o.getBranding().logoUrl(), o.getCreatedAt(), enabledModuleCount,
                    OrganizationProvisioningService.TOTAL_MODULE_COUNT);
        }
    }
}
