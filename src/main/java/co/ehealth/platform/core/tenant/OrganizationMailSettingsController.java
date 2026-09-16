package co.ehealth.platform.core.tenant;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

// ORG_ADMIN-only surface for the tenant's own outbound-email (SMTP)
// settings — the "Email" section of the tenant app's Settings tab. Both
// GET and PATCH live under /api/v1/admin/organization/mail-settings, unlike
// OrganizationBrandingController's split between an open GET and an
// admin-only POST: host/username/from-address are only useful to an admin
// deciding whether to change them, not something every staff member needs
// to see, so there's no reason for a wider-open read here. Covered by
// SecurityConfig's existing /api/v1/admin/** -> ORG_ADMIN matcher, same as
// StaffController's admin routes.
@RestController
public class OrganizationMailSettingsController {

    private final OrganizationMailSettingsService mailSettingsService;

    public OrganizationMailSettingsController(OrganizationMailSettingsService mailSettingsService) {
        this.mailSettingsService = mailSettingsService;
    }

    @GetMapping("/api/v1/admin/organization/mail-settings")
    public ResponseEntity<MailSettingsResponse> getMailSettings() {
        return ResponseEntity.ok(toResponse(mailSettingsService.getOwnMailSettings()));
    }

    @PatchMapping("/api/v1/admin/organization/mail-settings")
    public ResponseEntity<MailSettingsResponse> updateMailSettings(@RequestBody MailSettingsRequest request) {
        OrganizationMailSettings updated = mailSettingsService.updateOwnMailSettings(
                request.host(), request.port(), request.username(), request.password(), request.fromAddress());
        return ResponseEntity.ok(toResponse(updated));
    }

    // password is never echoed back, encrypted or not — passwordSet is the
    // only signal the frontend gets about whether one's configured, same
    // reasoning as User.passwordHash never being serialized anywhere.
    private static MailSettingsResponse toResponse(OrganizationMailSettings settings) {
        boolean passwordSet = settings.encryptedPassword() != null && !settings.encryptedPassword().isBlank();
        return new MailSettingsResponse(settings.host(), settings.port(), settings.username(), passwordSet,
                settings.fromAddress());
    }

    public record MailSettingsRequest(String host, Integer port, String username, String password,
                                       String fromAddress) {
    }

    public record MailSettingsResponse(String host, Integer port, String username, boolean passwordSet,
                                        String fromAddress) {
    }
}
