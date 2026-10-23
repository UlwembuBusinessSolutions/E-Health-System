package co.ehealth.platform.identity;

import co.ehealth.platform.core.security.JwtService;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/** Browser navigation endpoints are intentionally outside TenantFilter; state binds to server-side tenant. */
@RestController
@RequestMapping("/api/v1/auth/sso")
public class SsoAuthController {
    private final MicrosoftSsoService service;
    private final SsoSessionExchange tickets;
    private final co.ehealth.platform.core.tenant.OrganizationLookupService organizations;
    private final boolean secureCookie;
    public SsoAuthController(MicrosoftSsoService service, SsoSessionExchange tickets,
            co.ehealth.platform.core.tenant.OrganizationLookupService organizations,
            @org.springframework.beans.factory.annotation.Value("${app.backend.base-url}") String backendBaseUrl) {
        this.service = service;
        this.tickets = tickets;
        this.organizations = organizations;
        this.secureCookie = backendBaseUrl.startsWith("https://");
    }
    @GetMapping("/saml/start")
    public ResponseEntity<Void> startSaml(@RequestParam String tenantSlug) {
        var org = organizations.findActiveBySlug(tenantSlug);
        if (org.isEmpty() || !org.get().getSsoSettings().isUsable()
                || !"SAML".equals(org.get().getSsoSettings().resolvedProvider()))
            return redirect(service.frontendErrorRedirect(tenantSlug, "not_configured"));
        return redirect("/saml2/authenticate/" + java.net.URLEncoder.encode(tenantSlug, java.nio.charset.StandardCharsets.UTF_8));
    }
    @GetMapping({"/microsoft/start", "/oidc/start"})
    public ResponseEntity<Void> start(@RequestParam String tenantSlug) {
        String target = service.startLogin(tenantSlug);
        // Cookie-bound state prevents cross-browser OAuth login CSRF / session swapping.
        String query = java.net.URI.create(target).getRawQuery();
        if (query == null) return redirect(target);
        for (String param : query.split("&")) {
            if (param.startsWith("state=")) {
                String state = param.substring("state=".length());
                return ResponseEntity.status(HttpStatus.FOUND).header(HttpHeaders.LOCATION, target)
                        .header(HttpHeaders.SET_COOKIE, stateCookie(state, 300))
                        .header("Referrer-Policy", "no-referrer").cacheControl(CacheControl.noStore()).build();
            }
        }
        return redirect(target);
    }
    @GetMapping({"/microsoft/callback", "/oidc/callback"})
    public ResponseEntity<Void> callback(@RequestParam String state,
            @RequestParam(required = false) String code, @RequestParam(required = false) String error,
            @CookieValue(name = "SSO_STATE", required = false) String browserState) {
        boolean matches = browserState != null && java.security.MessageDigest.isEqual(
                state.getBytes(java.nio.charset.StandardCharsets.US_ASCII),
                browserState.getBytes(java.nio.charset.StandardCharsets.US_ASCII));
        String location = matches ? service.completeLogin(state, code, error)
                : service.invalidStateRedirect(state);
        return ResponseEntity.status(HttpStatus.FOUND).header(HttpHeaders.LOCATION, location)
                .header(HttpHeaders.SET_COOKIE, stateCookie("", 0))
                .header("Referrer-Policy", "no-referrer").cacheControl(CacheControl.noStore()).build();
    }
    @PostMapping("/exchange")
    public ResponseEntity<ExchangeResponse> exchange(@RequestBody ExchangeRequest request) {
        JwtService.IssuedToken token = tickets.consume(request.tenantSlug(), request.ticket());
        if (token == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).cacheControl(CacheControl.noStore()).build();
        return ResponseEntity.ok().cacheControl(CacheControl.noStore())
                .header(HttpHeaders.PRAGMA, "no-cache")
                .body(new ExchangeResponse(token.token(), token.expiresAt().toString()));
    }
    private String stateCookie(String value, int ttl) {
        return "SSO_STATE=" + value + "; HttpOnly; SameSite=Lax; Path=/api/v1/auth/sso; Max-Age=" + ttl
                + (secureCookie ? "; Secure" : "");
    }
    private static ResponseEntity<Void> redirect(String url) {
        return ResponseEntity.status(HttpStatus.FOUND).header(HttpHeaders.LOCATION, url)
                .header("Referrer-Policy", "no-referrer")
                .cacheControl(CacheControl.noStore()).build();
    }
    public record ExchangeRequest(String tenantSlug, String ticket) {}
    public record ExchangeResponse(String accessToken, String expiresAt) {}
}
