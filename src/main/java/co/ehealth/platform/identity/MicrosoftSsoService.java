package co.ehealth.platform.identity;

import co.ehealth.platform.core.common.SecretEncryptor;
import co.ehealth.platform.core.security.JwtService;
import co.ehealth.platform.core.tenant.*;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoders;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.Locale;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

/** Tenant-scoped OIDC authorization-code with PKCE, random state and nonce, signed ID-token validation. */
@Service
public class MicrosoftSsoService {
    private static final Logger log = LoggerFactory.getLogger(MicrosoftSsoService.class);
    private static final Duration TIMEOUT = Duration.ofSeconds(10);
    private static final Duration STATE_TTL = Duration.ofMinutes(5);
    private final OrganizationLookupService organizations;
    private final SecretEncryptor encryptor;
    private final AuthService auth;
    private final SsoSessionExchange tickets;
    private final String frontend;
    private final String backend;
    private final SecureRandom random = new SecureRandom();
    private final ConcurrentHashMap<String, AuthorizationAttempt> attempts = new ConcurrentHashMap<>();
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(TIMEOUT).build();
    private final ObjectMapper json = new ObjectMapper();
    private record AuthorizationAttempt(String tenant, String verifier, String nonce, Instant expires) {}

    public MicrosoftSsoService(OrganizationLookupService organizations, SecretEncryptor encryptor,
            AuthService auth, SsoSessionExchange tickets,
            @Value("${app.frontend.base-url}") String frontend,
            @Value("${app.backend.base-url}") String backend) {
        this.organizations = organizations;
        this.encryptor = encryptor;
        this.auth = auth;
        this.tickets = tickets;
        this.frontend = frontend;
        this.backend = backend;
    }

    public String startLogin(String tenantSlug) {
        Optional<Organization> maybe = organizations.findActiveBySlug(tenantSlug);
        if (maybe.isEmpty()) return frontendErrorRedirect(tenantSlug, "org_not_found");
        OrganizationSsoSettings s = maybe.get().getSsoSettings();
        if (!s.isUsable() || "SAML".equals(s.resolvedProvider()))
            return frontendErrorRedirect(tenantSlug, "not_configured");
        try {
            String issuer = checkedIssuer(s);
            // For Entra, the issuer has a well-known authorization endpoint; generic providers must publish discovery.
            String authorize = "MICROSOFT".equals(s.resolvedProvider())
                    ? issuer.substring(0, issuer.length()-5) + "/oauth2/v2.0/authorize"
                    : discover(issuer).path("authorization_endpoint").asText();
            requireHttps(authorize);
            byte[] secret = new byte[32]; random.nextBytes(secret);
            String state = Base64.getUrlEncoder().withoutPadding().encodeToString(secret);
            String verifier = randomUrl(32), nonce = randomUrl(32);
            String challenge = Base64.getUrlEncoder().withoutPadding().encodeToString(
                    MessageDigest.getInstance("SHA-256").digest(verifier.getBytes(StandardCharsets.US_ASCII)));
            attempts.entrySet().removeIf(e -> e.getValue().expires().isBefore(Instant.now()));
            attempts.put(state, new AuthorizationAttempt(tenantSlug, verifier, nonce, Instant.now().plus(STATE_TTL)));
            return authorize + (authorize.contains("?") ? "&" : "?")
                    + "response_type=code&client_id=" + enc(s.clientId())
                    + "&redirect_uri=" + enc(callback()) + "&scope=" + enc("openid email profile")
                    + "&state=" + enc(state) + "&nonce=" + enc(nonce)
                    + "&code_challenge=" + enc(challenge) + "&code_challenge_method=S256";
        } catch (Exception e) {
            log.warn("SSO discovery failed for tenant {}", tenantSlug, e);
            return frontendErrorRedirect(tenantSlug, "idp_unavailable");
        }
    }

    public String completeLogin(String state, String code, String error) {
        AuthorizationAttempt attempt = attempts.remove(state);
        if (attempt == null || attempt.expires().isBefore(Instant.now()))
            return frontendErrorRedirect("", "invalid_state");
        String tenant = attempt.tenant();
        if (error != null) return frontendErrorRedirect(tenant, "access_denied");
        if (code == null || code.isBlank()) return frontendErrorRedirect(tenant, "missing_code");
        Optional<Organization> maybe = organizations.findActiveBySlug(tenant);
        if (maybe.isEmpty()) return frontendErrorRedirect(tenant, "org_not_found");
        Organization organization = maybe.get();
        OrganizationSsoSettings s = organization.getSsoSettings();
        if (!s.isUsable() || "SAML".equals(s.resolvedProvider()))
            return frontendErrorRedirect(tenant, "not_configured");
        try {
            String issuer = checkedIssuer(s);
            String tokenEndpoint = "MICROSOFT".equals(s.resolvedProvider())
                    ? issuer.substring(0, issuer.length()-5) + "/oauth2/v2.0/token"
                    : discover(issuer).path("token_endpoint").asText();
            requireHttps(tokenEndpoint);
            String form = "grant_type=authorization_code&code=" + enc(code)
                    + "&redirect_uri=" + enc(callback()) + "&client_id=" + enc(s.clientId())
                    + "&client_secret=" + enc(encryptor.decrypt(s.encryptedClientSecret()))
                    + "&code_verifier=" + enc(attempt.verifier());
            HttpResponse<String> response = http.send(HttpRequest.newBuilder(URI.create(tokenEndpoint))
                    .timeout(TIMEOUT).header("Content-Type", "application/x-www-form-urlencoded")
                    .POST(HttpRequest.BodyPublishers.ofString(form)).build(), HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() != 200) return frontendErrorRedirect(tenant, "exchange_failed");
            JsonNode node = json.readTree(response.body());
            if (!node.hasNonNull("id_token")) return frontendErrorRedirect(tenant, "invalid_identity");
            // JwtDecoders discovers the IdP JWKS and validates signature, issuer, exp and nbf.
            Jwt verified = JwtDecoders.fromIssuerLocation(issuer).decode(node.get("id_token").asText());
            if (!verified.getAudience().contains(s.clientId())
                    || !attempt.nonce().equals(verified.getClaimAsString("nonce")))
                return frontendErrorRedirect(tenant, "invalid_identity");
            String subject = verified.getSubject();
            String email = verified.getClaimAsString("email");
            boolean emailTrusted = Boolean.TRUE.equals(verified.getClaim("email_verified"));
            // Microsoft Entra workforce tokens often lack email_verified. In that special case,
            // preferred_username is allowed only for explicitly restricted employer domains.
            if ("MICROSOFT".equals(s.resolvedProvider()) && !emailTrusted && s.allowedEmailDomain() != null) {
                email = verified.getClaimAsString("preferred_username");
                emailTrusted = email != null && email.toLowerCase(Locale.ROOT)
                        .endsWith("@" + s.allowedEmailDomain().toLowerCase(Locale.ROOT));
            }
            if (email == null || !emailTrusted) return frontendErrorRedirect(tenant, "unverified_email");
            TenantContext.setCurrentTenant(organization.getSchemaName());
            try {
                Optional<JwtService.IssuedToken> issued = auth.loginViaFederation(email,
                        verified.getClaimAsString("given_name"), verified.getClaimAsString("family_name"),
                        issuer, subject, emailTrusted, s);
                if (issued.isEmpty()) return frontendErrorRedirect(tenant, "not_authorized");
                String ticket = tickets.issue(tenant, issued.get());
                return frontend + "/org/" + enc(tenant) + "/sso/callback?ticket=" + enc(ticket);
            } finally { TenantContext.clear(); }
        } catch (Exception e) {
            log.warn("OIDC authentication failed for tenant {}", tenant, e);
            return frontendErrorRedirect(tenant, "idp_unavailable");
        }
    }

    private JsonNode discover(String issuer) throws Exception {
        requireHttps(issuer);
        String discovery = issuer.replaceAll("/$", "") + "/.well-known/openid-configuration";
        HttpResponse<String> response = http.send(HttpRequest.newBuilder(URI.create(discovery))
                .timeout(TIMEOUT).GET().build(), HttpResponse.BodyHandlers.ofString());
        if (response.statusCode() != 200) throw new IllegalStateException("Discovery unavailable");
        JsonNode node = json.readTree(response.body());
        if (!issuer.equals(node.path("issuer").asText())) throw new IllegalStateException("Issuer mismatch");
        return node;
    }
    private String checkedIssuer(OrganizationSsoSettings s) {
        String issuer = s.oidcIssuer(); requireHttps(issuer); return issuer;
    }
    private static void requireHttps(String uri) {
        URI u = URI.create(uri);
        if (!"https".equalsIgnoreCase(u.getScheme()) || u.getHost() == null || u.getUserInfo() != null)
            throw new IllegalArgumentException("Invalid IdP URL");
    }
    private String callback() { return backend + "/api/v1/auth/sso/oidc/callback"; }
    public String invalidStateRedirect(String state) {
        AuthorizationAttempt attempt = attempts.remove(state);
        String tenant = attempt == null ? "" : attempt.tenant();
        return frontendErrorRedirect(tenant, "invalid_state");
    }

    public String frontendErrorRedirect(String tenant, String errorCode) {
        return frontend + "/org/" + enc(tenant) + "/login?ssoError=" + enc(errorCode);
    }
    private String randomUrl(int bytes) {
        byte[] b = new byte[bytes]; random.nextBytes(b);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(b);
    }
    private static String enc(String v) { return URLEncoder.encode(v == null ? "" : v, StandardCharsets.UTF_8); }
}
