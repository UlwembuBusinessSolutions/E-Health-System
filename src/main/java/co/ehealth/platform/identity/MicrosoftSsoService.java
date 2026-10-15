package co.ehealth.platform.identity;

import co.ehealth.platform.core.common.SecretEncryptor;
import co.ehealth.platform.core.security.JwtService;
import co.ehealth.platform.core.tenant.Organization;
import co.ehealth.platform.core.tenant.OrganizationLookupService;
import co.ehealth.platform.core.tenant.OrganizationSsoSettings;
import co.ehealth.platform.core.tenant.TenantContext;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Optional;

// Backend-driven Microsoft SSO (Azure AD / Entra ID) — one Azure AD "app
// registration" per organization (OrganizationSsoSettings), the same
// "bring your own account" shape OrganizationMailSettings already uses for
// SMTP: a clinic's own IT admin registers an application in THEIR Azure AD
// tenant (with this backend's own /callback URL as its one redirect URI)
// and pastes its directory id, application (client) id, and a client
// secret into Settings > Single sign-on. The whole exchange — the
// authorization-code grant, then a Microsoft Graph call for the verified
// email — happens server-side; the frontend never sees a client id,
// secret, or Microsoft token, only this app's own JWT at the very end,
// identical in shape to what a password login returns.
@Service
public class MicrosoftSsoService {

    private static final Logger log = LoggerFactory.getLogger(MicrosoftSsoService.class);
    private static final String SCOPE = "openid email profile";
    private static final Duration REQUEST_TIMEOUT = Duration.ofSeconds(10);

    private final OrganizationLookupService organizationLookupService;
    private final SecretEncryptor secretEncryptor;
    private final AuthService authService;
    private final String frontendBaseUrl;
    private final String backendCallbackUrl;
    private final HttpClient httpClient = HttpClient.newBuilder().connectTimeout(REQUEST_TIMEOUT).build();
    private final ObjectMapper objectMapper = new ObjectMapper();

    public MicrosoftSsoService(OrganizationLookupService organizationLookupService, SecretEncryptor secretEncryptor,
                                AuthService authService,
                                @Value("${app.frontend.base-url}") String frontendBaseUrl,
                                @Value("${app.backend.base-url}") String backendBaseUrl) {
        this.organizationLookupService = organizationLookupService;
        this.secretEncryptor = secretEncryptor;
        this.authService = authService;
        this.frontendBaseUrl = frontendBaseUrl;
        this.backendCallbackUrl = backendBaseUrl + "/api/v1/auth/sso/microsoft/callback";
    }

    // Builds the Microsoft "sign in" URL to redirect the browser to, or —
    // if this org doesn't exist or hasn't finished configuring SSO — a
    // frontend error redirect instead. Never throws: SsoAuthController's
    // /start endpoint has no JSON caller to hand a validation error to,
    // only a browser mid-navigation.
    //
    // The organization slug IS the OAuth "state" param — Microsoft only
    // ever echoes it back verbatim on the way to /callback, never inspects
    // it, and there's no server-side session here to tie a
    // cryptographically-random state to anyway (this app is JWT-only
    // throughout, no session store). That's not a weaker CSRF posture than
    // it sounds: the actual security boundary is completeLogin() below
    // requiring a real authorization code, which Microsoft will only ever
    // issue to someone who authenticated against THIS org's real Azure AD
    // tenant — tampering with state alone just points the exchange at a
    // different org's client id/secret, which Microsoft's own token
    // endpoint then refuses unless the code was actually issued for that
    // org's app registration.
    public String startLogin(String tenantSlug) {
        Optional<Organization> maybeOrg = organizationLookupService.findActiveBySlug(tenantSlug);
        if (maybeOrg.isEmpty()) {
            return frontendErrorRedirect(tenantSlug, "org_not_found");
        }
        OrganizationSsoSettings settings = maybeOrg.get().getSsoSettings();
        if (!settings.isUsable()) {
            return frontendErrorRedirect(tenantSlug, "not_configured");
        }
        return "https://login.microsoftonline.com/" + enc(settings.microsoftTenantId()) + "/oauth2/v2.0/authorize"
                + "?client_id=" + enc(settings.clientId())
                + "&response_type=code"
                + "&redirect_uri=" + enc(backendCallbackUrl)
                + "&response_mode=query"
                + "&scope=" + enc(SCOPE)
                + "&state=" + enc(tenantSlug);
    }

    // Exchanges the authorization code for tokens, resolves the signed-in
    // Microsoft account's email via Graph, matches it to an existing staff
    // account in that org, and returns where the browser should land next
    // — success carries this app's own JWT (frontendSuccessRedirect()),
    // any failure a plain error code the login screen turns into a message
    // (frontendErrorRedirect()). Never throws past itself: every failure
    // mode is a redirect target, not a stack trace, for the same reason
    // startLogin() above never does — this is a full-page browser
    // navigation with nobody to hand a JSON body to. Deliberately does NOT
    // auto-provision a new staff account on a first-time Microsoft
    // sign-in: SSO here is an alternate way for an EXISTING staff member to
    // reach their existing account (matched by email), not a self-service
    // signup path — creating accounts (with a role, facility, licence
    // numbers, ...) is StaffController's job, run by an ORG_ADMIN.
    public String completeLogin(String tenantSlug, String code) {
        Optional<Organization> maybeOrg = organizationLookupService.findActiveBySlug(tenantSlug);
        if (maybeOrg.isEmpty()) {
            return frontendErrorRedirect(tenantSlug, "org_not_found");
        }
        Organization organization = maybeOrg.get();
        OrganizationSsoSettings settings = organization.getSsoSettings();
        if (!settings.isUsable()) {
            return frontendErrorRedirect(tenantSlug, "not_configured");
        }
        if (code == null || code.isBlank()) {
            return frontendErrorRedirect(tenantSlug, "microsoft_no_code");
        }

        String email;
        try {
            String accessToken = exchangeCodeForAccessToken(settings, code);
            email = fetchEmailFromGraph(accessToken);
        } catch (Exception e) {
            log.warn("Microsoft SSO exchange failed for organization {}", tenantSlug, e);
            return frontendErrorRedirect(tenantSlug, "exchange_failed");
        }
        if (email == null) {
            return frontendErrorRedirect(tenantSlug, "no_email");
        }

        TenantContext.setCurrentTenant(organization.getSchemaName());
        try {
            Optional<JwtService.IssuedToken> issued = authService.loginViaSso(email);
            return issued.map(token -> frontendSuccessRedirect(tenantSlug, token))
                    .orElseGet(() -> frontendErrorRedirect(tenantSlug, "no_account"));
        } finally {
            TenantContext.clear();
        }
    }

    public String frontendErrorRedirect(String tenantSlug, String errorCode) {
        return frontendBaseUrl + "/org/" + enc(tenantSlug) + "/login?ssoError=" + enc(errorCode);
    }

    private String frontendSuccessRedirect(String tenantSlug, JwtService.IssuedToken issued) {
        return frontendBaseUrl + "/org/" + enc(tenantSlug) + "/sso/callback"
                + "?token=" + enc(issued.token())
                + "&expiresAt=" + enc(issued.expiresAt().toString());
    }

    // Standard OAuth2 authorization-code grant against Microsoft's own
    // v2.0 token endpoint — redirect_uri here must be byte-for-byte the
    // same value sent in startLogin()'s own authorize URL, per the OAuth2
    // spec (Microsoft rejects a mismatch).
    private String exchangeCodeForAccessToken(OrganizationSsoSettings settings, String code) throws Exception {
        String clientSecret = secretEncryptor.decrypt(settings.encryptedClientSecret());
        String form = "client_id=" + enc(settings.clientId())
                + "&client_secret=" + enc(clientSecret)
                + "&code=" + enc(code)
                + "&grant_type=authorization_code"
                + "&redirect_uri=" + enc(backendCallbackUrl);
        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create("https://login.microsoftonline.com/" + enc(settings.microsoftTenantId())
                        + "/oauth2/v2.0/token"))
                .timeout(REQUEST_TIMEOUT)
                .header("Content-Type", "application/x-www-form-urlencoded")
                .POST(HttpRequest.BodyPublishers.ofString(form))
                .build();
        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
        if (response.statusCode() != 200) {
            throw new IllegalStateException("Microsoft token exchange failed: HTTP " + response.statusCode());
        }
        JsonNode accessToken = objectMapper.readTree(response.body()).get("access_token");
        if (accessToken == null || accessToken.isNull()) {
            throw new IllegalStateException("Microsoft token response had no access_token");
        }
        return accessToken.asText();
    }

    // mail falls back to userPrincipalName — a Microsoft/Entra account's
    // "mail" attribute is sometimes unset for accounts provisioned without
    // an Exchange mailbox, while userPrincipalName (the sign-in identity,
    // usually an email-shaped UPN) is always present. Either is matched
    // against User.email the same way a password login's own email field
    // is.
    private String fetchEmailFromGraph(String accessToken) throws Exception {
        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create("https://graph.microsoft.com/v1.0/me?$select=mail,userPrincipalName"))
                .timeout(REQUEST_TIMEOUT)
                .header("Authorization", "Bearer " + accessToken)
                .GET()
                .build();
        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
        if (response.statusCode() != 200) {
            throw new IllegalStateException("Microsoft Graph /me failed: HTTP " + response.statusCode());
        }
        JsonNode body = objectMapper.readTree(response.body());
        JsonNode mail = body.get("mail");
        if (mail != null && !mail.isNull() && !mail.asText().isBlank()) {
            return mail.asText();
        }
        JsonNode upn = body.get("userPrincipalName");
        return upn != null && !upn.isNull() && !upn.asText().isBlank() ? upn.asText() : null;
    }

    private static String enc(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8);
    }
}
