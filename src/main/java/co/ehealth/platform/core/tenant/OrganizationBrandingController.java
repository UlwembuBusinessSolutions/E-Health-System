package co.ehealth.platform.core.tenant;

import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;
import java.util.UUID;

// The tenant-facing "my organization" read/write surface — what any
// authenticated staff member (GET /api/v1/organization, its /modules
// sibling) or ORG_ADMIN specifically (the logo POST) can see or change
// about their own org, as opposed to PlatformController's equivalent for a
// platform operator managing an arbitrary org by id. Full paths per method,
// not a shared class-level @RequestMapping — the three endpoints
// deliberately live under different security rules.
// /api/v1/admin/organization/logo falls under SecurityConfig's
// /api/v1/admin/** -> ORG_ADMIN matcher; the two GETs don't, so they fall
// through to .anyRequest().authenticated() instead — same split
// FacilityController uses between its GET and POST.
@RestController
public class OrganizationBrandingController {

    private final OrganizationBrandingService brandingService;
    private final ModuleEntitlementQueryService moduleEntitlementQueryService;

    public OrganizationBrandingController(OrganizationBrandingService brandingService,
                                           ModuleEntitlementQueryService moduleEntitlementQueryService) {
        this.brandingService = brandingService;
        this.moduleEntitlementQueryService = moduleEntitlementQueryService;
    }

    // Any authenticated staff member, not just ORG_ADMIN — every field here
    // (name, status, sector, branding) is meant to be seen by everyone in
    // the org, same reasoning as GET /api/v1/facilities being open to any
    // authenticated user while only its POST is admin-gated. Started as
    // branding-only (logoUrl/primaryColor/shortName); displayName/slug/
    // status/sector were folded in once the real tenant dashboard needed
    // them rather than adding a second near-identical endpoint.
    @GetMapping("/api/v1/organization")
    public ResponseEntity<OrganizationSelfResponse> getOrganization() {
        Organization organization = brandingService.getOwnOrganization();
        OrganizationBranding branding = organization.getBranding();
        return ResponseEntity.ok(new OrganizationSelfResponse(
                organization.getDisplayName(), organization.getSlug(), organization.getStatus(),
                organization.getSector(), branding.logoUrl(), branding.primaryColor(), branding.shortName()));
    }

    // The tenant dashboard's "enabled modules" card (SADM-US-010, self-
    // service half) — same 20-module shape and same query service
    // PlatformController's platform-operator equivalent uses, just always
    // resolved to the caller's own org rather than an {id} path variable.
    @GetMapping("/api/v1/organization/modules")
    public ResponseEntity<Map<String, Object>> getModules() {
        UUID organizationId = brandingService.getOwnOrganization().getId();
        List<ModuleEntitlementView> modules = moduleEntitlementQueryService.listForOrganization(organizationId);
        return ResponseEntity.ok(Map.of("items", modules));
    }

    // Multipart, not JSON — same reasoning as StaffController.uploadPhoto():
    // file-type validation happens inside the service, nothing here for
    // Bean Validation to attach to on a MultipartFile parameter. Callable
    // any time, not just at provisioning — a second upload replaces the
    // first (see OrganizationBrandingService's why-note on the deterministic
    // S3 key).
    @PostMapping(value = "/api/v1/admin/organization/logo", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<LogoUploadResponse> uploadLogo(@RequestParam("file") MultipartFile file) {
        String url = brandingService.uploadLogo(file);
        return ResponseEntity.ok(new LogoUploadResponse(url));
    }

    public record LogoUploadResponse(String logoUrl) {
    }

    public record OrganizationSelfResponse(String displayName, String slug, OrganizationStatus status,
                                            OrganizationSector sector, String logoUrl, String primaryColor,
                                            String shortName) {
    }
}
