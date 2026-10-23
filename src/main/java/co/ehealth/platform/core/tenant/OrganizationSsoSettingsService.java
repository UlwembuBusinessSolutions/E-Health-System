package co.ehealth.platform.core.tenant;

import co.ehealth.platform.core.common.SecretEncryptor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.net.URI;
import java.util.Locale;
import java.util.Set;

@Service
public class OrganizationSsoSettingsService {
    private final OrganizationRepository organizations;
    private final SecretEncryptor encryptor;

    public OrganizationSsoSettingsService(OrganizationRepository organizations, SecretEncryptor encryptor) {
        this.organizations = organizations;
        this.encryptor = encryptor;
    }

    public OrganizationSsoSettings getOwnSsoSettings() { return own().getSsoSettings(); }

    @Transactional
    public OrganizationSsoSettings updateOwnSsoSettings(boolean enabled, String microsoftTenantId, String clientId,
            String rawClientSecret, String provider, String issuerUri, String samlIdpEntityId, String samlSsoUrl,
            String samlCertificate, Boolean nativeLoginAllowed, boolean jitEnabled, String allowedEmailDomain) {
        Organization org = own();
        OrganizationSsoSettings old = org.getSsoSettings();
        String chosenProvider = provider == null || provider.isBlank() ? old.resolvedProvider() : provider.toUpperCase(Locale.ROOT);
        if (!Set.of("MICROSOFT", "OIDC", "SAML").contains(chosenProvider)) {
            throw new IllegalArgumentException("SSO provider must be MICROSOFT, OIDC or SAML");
        }
        // Never silently reuse the former identity provider's confidential client credential.
        String secret = rawClientSecret == null || rawClientSecret.isBlank()
                ? (old.resolvedProvider().equals(chosenProvider) ? old.encryptedClientSecret() : null)
                : encryptor.encrypt(rawClientSecret);
        String domain = blankToNull(allowedEmailDomain);
        if (domain != null && !domain.matches("(?i)^[a-z0-9](?:[a-z0-9.-]{0,251}[a-z0-9])?\\.[a-z]{2,}$")) {
            throw new IllegalArgumentException("Supply a valid employer email domain");
        }
        if (enabled && jitEnabled && domain == null) {
            throw new IllegalArgumentException("Just-in-time provisioning requires a trusted email domain");
        }
        String issuer = blankToNull(issuerUri);
        String ssoUrl = blankToNull(samlSsoUrl);
        if (enabled && "OIDC".equals(chosenProvider)) requireHttps(issuer, "OIDC issuer");
        if (enabled && "SAML".equals(chosenProvider)) requireHttps(ssoUrl, "SAML IdP SSO URL");
        String tid = blankToNull(microsoftTenantId);
        if (enabled && "MICROSOFT".equals(chosenProvider) && (tid == null || !tid.matches("[0-9a-fA-F-]{36}"))) {
            throw new IllegalArgumentException("A valid Microsoft directory UUID is required");
        }
        String certificate = blankToNull(samlCertificate);
        if (certificate == null) certificate = old.samlVerificationCertificate();
        if (enabled && "SAML".equals(chosenProvider)) {
            if (certificate == null) throw new IllegalArgumentException("An IdP signing certificate is required");
            try {
                String der = certificate.replace("-----BEGIN CERTIFICATE-----", "")
                        .replace("-----END CERTIFICATE-----", "").replaceAll("\\s", "");
                byte[] bytes = java.util.Base64.getDecoder().decode(der);
                var cert = (java.security.cert.X509Certificate) java.security.cert.CertificateFactory
                        .getInstance("X.509").generateCertificate(new java.io.ByteArrayInputStream(bytes));
                cert.checkValidity();
            } catch (Exception e) { throw new IllegalArgumentException("Invalid or expired IdP signing certificate"); }
        }
        OrganizationSsoSettings settings = new OrganizationSsoSettings(enabled, tid, blankToNull(clientId), secret,
                chosenProvider, issuer, blankToNull(samlIdpEntityId), ssoUrl, certificate,
                nativeLoginAllowed == null ? old.allowsNativeLogin() : nativeLoginAllowed,
                jitEnabled, domain == null ? null : domain.toLowerCase(Locale.ROOT));
        if (enabled && !settings.isUsable()) throw new IllegalArgumentException("Complete the identity provider configuration before enabling SSO");
        org.setSsoSettings(settings);
        organizations.save(org);
        return settings;
    }

    private static void requireHttps(String value, String label) {
        try {
            URI uri = URI.create(value);
            if (!"https".equalsIgnoreCase(uri.getScheme()) || uri.getHost() == null || uri.getUserInfo() != null)
                throw new IllegalArgumentException();
        } catch (RuntimeException e) { throw new IllegalArgumentException(label + " must be a valid HTTPS URL"); }
    }
    private static String blankToNull(String s) { return s == null || s.isBlank() ? null : s.trim(); }
    private Organization own() {
        return organizations.findBySchemaName(TenantContext.getCurrentTenant())
                .orElseThrow(() -> new IllegalStateException("Unknown tenant"));
    }
}
