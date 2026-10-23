package co.ehealth.platform.identity;

import co.ehealth.platform.core.tenant.Organization;
import co.ehealth.platform.core.tenant.OrganizationLookupService;
import co.ehealth.platform.core.tenant.OrganizationSsoSettings;
import co.ehealth.platform.core.tenant.TenantContext;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.Authentication;
import org.springframework.security.saml2.provider.service.authentication.Saml2AuthenticatedPrincipal;
import org.springframework.stereotype.Component;
import java.io.IOException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;

/** Called *only after* Spring Security has validated the IdP XML signature and SAML conditions. */
@Component
public class TenantSamlSuccessHandler {
    private final OrganizationLookupService organizations;
    private final AuthService auth;
    private final SsoSessionExchange tickets;
    private final String frontend;
    public TenantSamlSuccessHandler(OrganizationLookupService organizations, AuthService auth,
            SsoSessionExchange tickets, @Value("${app.frontend.base-url}") String frontend) {
        this.organizations = organizations;
        this.auth = auth;
        this.tickets = tickets;
        this.frontend = frontend;
    }
    public void success(HttpServletRequest request, HttpServletResponse response, Authentication authentication)
            throws IOException {
        String slug = request.getRequestURI().replaceFirst("^.*/login/saml2/sso/", "");
        Organization organization = organizations.findActiveBySlug(slug).orElse(null);
        if (organization == null || !(authentication.getPrincipal() instanceof Saml2AuthenticatedPrincipal principal)) {
            fail(response, slug); return;
        }
        OrganizationSsoSettings s = organization.getSsoSettings();
        if (!s.isUsable() || !"SAML".equals(s.resolvedProvider())) { fail(response, slug); return; }
        String email = first(principal, "email", "mail", "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress");
        if (email == null) { fail(response, slug); return; }
        String firstName = first(principal, "givenName", "firstName");
        String lastName = first(principal, "surname", "lastName", "sn");
        TenantContext.setCurrentTenant(organization.getSchemaName());
        try {
            // Signed assertion and trusted tenant IdP certificate establish email provenance;
            // JIT additionally requires a configured employer-domain allowlist.
            var issued = auth.loginViaFederation(email, firstName, lastName,
                    s.samlIdpEntityId(), principal.getName(), true, s);
            if (issued.isEmpty()) { fail(response, slug); return; }
            String ticket = tickets.issue(slug, issued.get());
            response.setHeader("Referrer-Policy", "no-referrer");
            response.setHeader("Cache-Control", "no-store");
            response.sendRedirect(frontend + "/org/" + enc(slug) + "/sso/callback?ticket=" + enc(ticket));
        } finally { TenantContext.clear(); }
    }
    public void failure(HttpServletRequest request, HttpServletResponse response, Exception error) throws IOException {
        String slug = request.getRequestURI().replaceFirst("^.*/login/saml2/sso/", "");
        response.sendRedirect(frontend + "/org/" + enc(slug) + "/login?ssoError=saml_failed");
    }
    private void fail(HttpServletResponse response, String slug) throws IOException {
        response.sendRedirect(frontend + "/org/" + enc(slug) + "/login?ssoError=not_authorized");
    }
    private static String enc(String s) { return URLEncoder.encode(s, StandardCharsets.UTF_8); }
    private static String first(Saml2AuthenticatedPrincipal principal, String... names) {
        for (String name : names) {
            Object v = principal.getFirstAttribute(name);
            if (v instanceof String str && !str.isBlank()) return str;
        }
        return null;
    }
}
