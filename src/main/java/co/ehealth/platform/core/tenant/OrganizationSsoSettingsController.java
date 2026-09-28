package co.ehealth.platform.core.tenant;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

// ORG_ADMIN-only surface for the tenant's own Microsoft SSO (Azure AD)
// configuration — the "Single sign-on" section of the tenant app's
// Settings tab. Same shape as OrganizationMailSettingsController: both GET
// and PATCH live under /api/v1/admin/organization/sso-settings, covered by
// SecurityConfig's existing /api/v1/admin/** -> ORG_ADMIN matcher.
@RestController
public class OrganizationSsoSettingsController {

    private final OrganizationSsoSettingsService ssoSettingsService;

    public OrganizationSsoSettingsController(OrganizationSsoSettingsService ssoSettingsService) {
        this.ssoSettingsService = ssoSettingsService;
    }

    @GetMapping("/api/v1/admin/organization/sso-settings")
    public ResponseEntity<SsoSettingsResponse> getSsoSettings() {
        return ResponseEntity.ok(toResponse(ssoSettingsService.getOwnSsoSettings()));
    }

    @PatchMapping("/api/v1/admin/organization/sso-settings")
    public ResponseEntity<SsoSettingsResponse> updateSsoSettings(@RequestBody SsoSettingsRequest request) {
        OrganizationSsoSettings updated = ssoSettingsService.updateOwnSsoSettings(
                request.enabled(), request.microsoftTenantId(), request.clientId(), request.clientSecret());
        return ResponseEntity.ok(toResponse(updated));
    }

    // clientSecret is never echoed back, encrypted or not — clientSecretSet
    // is the only signal the frontend gets about whether one's configured,
    // same reasoning as OrganizationMailSettingsController's own
    // passwordSet. usable rides along too, so the settings form can tell
    // an admin "this is live" versus "saved, but not yet complete" without
    // duplicating OrganizationSsoSettings.isUsable()'s own logic client-side.
    private static SsoSettingsResponse toResponse(OrganizationSsoSettings settings) {
        boolean clientSecretSet = settings.encryptedClientSecret() != null
                && !settings.encryptedClientSecret().isBlank();
        return new SsoSettingsResponse(settings.enabled(), settings.microsoftTenantId(), settings.clientId(),
                clientSecretSet, settings.isUsable());
    }

    public record SsoSettingsRequest(boolean enabled, String microsoftTenantId, String clientId,
                                      String clientSecret) {
    }

    public record SsoSettingsResponse(boolean enabled, String microsoftTenantId, String clientId,
                                       boolean clientSecretSet, boolean usable) {
    }
}
