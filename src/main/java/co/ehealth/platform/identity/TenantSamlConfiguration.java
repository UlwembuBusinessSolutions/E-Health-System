package co.ehealth.platform.identity;

import co.ehealth.platform.core.tenant.Organization;
import co.ehealth.platform.core.tenant.OrganizationLookupService;
import co.ehealth.platform.core.tenant.OrganizationSsoSettings;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.saml2.provider.service.registration.RelyingPartyRegistration;
import org.springframework.security.saml2.provider.service.registration.RelyingPartyRegistrationRepository;
import org.springframework.security.saml2.core.Saml2X509Credential;
import org.springframework.stereotype.Component;

import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import java.security.cert.CertificateFactory;
import java.security.cert.X509Certificate;
import java.util.Base64;

/** The registration id is the tenant slug; config is always resolved fresh from the CONTROL schema. */
@Component
public class TenantSamlConfiguration implements RelyingPartyRegistrationRepository {
    private final OrganizationLookupService organizations;
    private final String backend;
    public TenantSamlConfiguration(OrganizationLookupService organizations,
            @Value("${app.backend.base-url}") String backend) {
        this.organizations = organizations;
        this.backend = backend;
    }
    @Override
    public RelyingPartyRegistration findByRegistrationId(String slug) {
        if (slug == null || !slug.matches("[a-z0-9][a-z0-9-]{0,62}")) return null;
        Organization org = organizations.findActiveBySlug(slug).orElse(null);
        if (org == null) return null;
        OrganizationSsoSettings s = org.getSsoSettings();
        if (!s.isUsable() || !"SAML".equals(s.resolvedProvider())) return null;
        try {
            String pem = s.samlVerificationCertificate()
                    .replace("-----BEGIN CERTIFICATE-----", "")
                    .replace("-----END CERTIFICATE-----", "")
                    .replaceAll("\\s", "");
            byte[] bytes = Base64.getDecoder().decode(pem);
            X509Certificate cert = (X509Certificate) CertificateFactory.getInstance("X.509")
                    .generateCertificate(new ByteArrayInputStream(bytes));
            cert.checkValidity();
            Saml2X509Credential trusted = Saml2X509Credential.verification(cert);
            return RelyingPartyRegistration.withRegistrationId(slug)
                    .entityId(backend + "/saml2/service-provider-metadata/" + slug)
                    .assertionConsumerServiceLocation(backend + "/login/saml2/sso/" + slug)
                    .assertingPartyDetails(p -> p.entityId(s.samlIdpEntityId())
                            .singleSignOnServiceLocation(s.samlSsoUrl())
                            .wantAuthnRequestsSigned(false)
                            .verificationX509Credentials(c -> c.add(trusted)))
                    .build();
        } catch (Exception e) {
            throw new IllegalArgumentException("Invalid tenant SAML signing certificate", e);
        }
    }
}
