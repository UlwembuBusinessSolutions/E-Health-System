package co.ehealth.platform.core.tenant;

import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

// Path falls under /api/v1/admin/**, so SecurityConfig's existing
// hasRole("ORG_ADMIN") matcher already covers this — no security config
// change needed, same as StaffController's photo endpoint.
@RestController
@RequestMapping("/api/v1/admin/organization")
public class OrganizationBrandingController {

    private final OrganizationBrandingService brandingService;

    public OrganizationBrandingController(OrganizationBrandingService brandingService) {
        this.brandingService = brandingService;
    }

    // Multipart, not JSON — same reasoning as StaffController.uploadPhoto():
    // file-type validation happens inside the service, nothing here for
    // Bean Validation to attach to on a MultipartFile parameter. Callable
    // any time, not just at provisioning — a second upload replaces the
    // first (see OrganizationBrandingService's why-note on the deterministic
    // S3 key).
    @PostMapping(value = "/logo", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<LogoUploadResponse> uploadLogo(@RequestParam("file") MultipartFile file) {
        String url = brandingService.uploadLogo(file);
        return ResponseEntity.ok(new LogoUploadResponse(url));
    }

    public record LogoUploadResponse(String logoUrl) {
    }
}
