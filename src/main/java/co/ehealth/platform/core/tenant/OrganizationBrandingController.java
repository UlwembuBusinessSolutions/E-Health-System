package co.ehealth.platform.core.tenant;

import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

// Full paths per method, not a shared class-level @RequestMapping — the
// two endpoints deliberately live under different security rules.
// /api/v1/admin/organization/logo falls under SecurityConfig's
// /api/v1/admin/** -> ORG_ADMIN matcher; /api/v1/organization does not, so
// it falls through to .anyRequest().authenticated() instead — same split
// FacilityController uses between its GET and POST, just expressed as two
// different paths here instead of one path split by HTTP method, since
// "view the org's logo" and "upload the org's logo" were never going to
// share a path the way facility list/create do.
@RestController
public class OrganizationBrandingController {

    private final OrganizationBrandingService brandingService;

    public OrganizationBrandingController(OrganizationBrandingService brandingService) {
        this.brandingService = brandingService;
    }

    // Any authenticated staff member, not just ORG_ADMIN — a logo is meant
    // to be seen by everyone in the org, same reasoning as
    // GET /api/v1/facilities being open to any authenticated user while
    // only its POST is admin-gated.
    @GetMapping("/api/v1/organization")
    public ResponseEntity<OrganizationBrandingResponse> getBranding() {
        OrganizationBranding branding = brandingService.getBranding();
        return ResponseEntity.ok(
                new OrganizationBrandingResponse(branding.logoUrl(), branding.primaryColor(), branding.shortName()));
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

    public record OrganizationBrandingResponse(String logoUrl, String primaryColor, String shortName) {
    }
}
