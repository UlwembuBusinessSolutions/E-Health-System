package co.ehealth.platform.core.tenant;

import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
public class OrganizationSsoSettingsController {
    private final OrganizationSsoSettingsService service;
    public OrganizationSsoSettingsController(OrganizationSsoSettingsService service) { this.service = service; }

    @GetMapping("/api/v1/admin/organization/sso-settings")
    public ResponseEntity<SsoSettingsResponse> getSsoSettings() {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(response(service.getOwnSsoSettings()));
    }
    @PatchMapping("/api/v1/admin/organization/sso-settings")
    public ResponseEntity<SsoSettingsResponse> updateSsoSettings(@RequestBody SsoSettingsRequest request) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(response(service.updateOwnSsoSettings(
                request.enabled(), request.microsoftTenantId(), request.clientId(), request.clientSecret(),
                request.provider(), request.issuerUri(), request.samlIdpEntityId(), request.samlSsoUrl(),
                request.samlVerificationCertificate(), request.nativeLoginAllowed(),
                request.jitProvisioningEnabled(), request.allowedEmailDomain())));
    }
    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<co.ehealth.platform.core.common.ApiErrorResponse> invalidSsoConfiguration(
            IllegalArgumentException exception) {
        return ResponseEntity.badRequest().body(new co.ehealth.platform.core.common.ApiErrorResponse(
                exception.getMessage(), null));
    }

    static SsoSettingsResponse response(OrganizationSsoSettings s) {
        return new SsoSettingsResponse(s.enabled(), s.microsoftTenantId(), s.clientId(),
                s.encryptedClientSecret() != null && !s.encryptedClientSecret().isBlank(),
                s.isUsable(), s.resolvedProvider(), s.issuerUri(), s.samlIdpEntityId(), s.samlSsoUrl(),
                s.samlVerificationCertificate() != null && !s.samlVerificationCertificate().isBlank(),
                s.allowsNativeLogin(), s.jitProvisioningEnabled(), s.allowedEmailDomain());
    }
    public record SsoSettingsRequest(boolean enabled, String microsoftTenantId, String clientId, String clientSecret,
            String provider, String issuerUri, String samlIdpEntityId, String samlSsoUrl,
            String samlVerificationCertificate, Boolean nativeLoginAllowed, boolean jitProvisioningEnabled,
            String allowedEmailDomain) {}
    public record SsoSettingsResponse(boolean enabled, String microsoftTenantId, String clientId,
            boolean clientSecretSet, boolean usable, String provider, String issuerUri, String samlIdpEntityId,
            String samlSsoUrl, boolean samlCertificateSet, boolean nativeLoginAllowed,
            boolean jitProvisioningEnabled, String allowedEmailDomain) {}
}
