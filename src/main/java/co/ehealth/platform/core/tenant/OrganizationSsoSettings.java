package co.ehealth.platform.core.tenant;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

/** Tenant-owned federated identity configuration. Client secret is always stored encrypted. */
@JsonIgnoreProperties(ignoreUnknown = true)
public record OrganizationSsoSettings(
        boolean enabled, String microsoftTenantId, String clientId, String encryptedClientSecret,
        String provider, String issuerUri, String samlIdpEntityId, String samlSsoUrl,
        String samlVerificationCertificate, Boolean nativeLoginAllowed,
        boolean jitProvisioningEnabled, String allowedEmailDomain) {

    public OrganizationSsoSettings(boolean enabled, String microsoftTenantId, String clientId, String encryptedClientSecret) {
        this(enabled, microsoftTenantId, clientId, encryptedClientSecret, "MICROSOFT", null, null, null,
                null, true, false, null);
    }

    public static OrganizationSsoSettings empty() {
        return new OrganizationSsoSettings(false, null, null, null);
    }

    @JsonIgnore
    public String resolvedProvider() {
        return provider == null || provider.isBlank() ? "MICROSOFT" : provider.toUpperCase(java.util.Locale.ROOT);
    }

    @JsonIgnore
    public boolean allowsNativeLogin() {
        // Old tenants continue to support password login without a migration-induced lockout.
        return nativeLoginAllowed == null || nativeLoginAllowed;
    }

    @JsonIgnore
    public String oidcIssuer() {
        if ("MICROSOFT".equals(resolvedProvider())) {
            return microsoftTenantId == null ? null :
                    "https://login.microsoftonline.com/" + microsoftTenantId + "/v2.0";
        }
        return issuerUri;
    }

    @JsonIgnore
    public boolean isUsable() {
        if (!enabled) return false;
        if ("SAML".equals(resolvedProvider())) {
            return present(samlIdpEntityId) && present(samlSsoUrl) && present(samlVerificationCertificate);
        }
        if ("OIDC".equals(resolvedProvider())) {
            return present(issuerUri) && present(clientId) && present(encryptedClientSecret);
        }
        return "MICROSOFT".equals(resolvedProvider()) && present(microsoftTenantId)
                && present(clientId) && present(encryptedClientSecret);
    }

    private static boolean present(String value) { return value != null && !value.isBlank(); }
}
