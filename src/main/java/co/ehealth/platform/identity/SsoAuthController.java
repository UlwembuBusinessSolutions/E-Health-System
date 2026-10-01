package co.ehealth.platform.identity;

import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

// The one identity surface reachable with no X-Tenant-ID header or
// Authorization token at all — TenantFilter.shouldNotFilter() and
// SecurityConfig's own permitAll entry both carve this path out on
// purpose (both their own why-notes): a real browser redirecting here
// from Microsoft's own sign-in page, or landing here fresh from a login
// screen's link, can't attach either the way every other tenant-scoped
// call in this app does, so the tenant travels as an explicit query
// parameter instead (MicrosoftSsoService.startLogin()'s own why-note on
// why that's safe here). Every response here is a redirect, never a JSON
// body — this is full-page browser navigation, not an AJAX call.
@RestController
@RequestMapping("/api/v1/auth/sso/microsoft")
public class SsoAuthController {

    private final MicrosoftSsoService microsoftSsoService;

    public SsoAuthController(MicrosoftSsoService microsoftSsoService) {
        this.microsoftSsoService = microsoftSsoService;
    }

    // What the login screen's "Sign in with Microsoft" link points
    // straight at — a plain <a href>, not a fetch, since a fetch response
    // can't be followed cross-origin the way a real browser navigation to
    // Microsoft's own sign-in page needs to be.
    @GetMapping("/start")
    public ResponseEntity<Void> start(@RequestParam String tenantSlug) {
        return redirect(microsoftSsoService.startLogin(tenantSlug));
    }

    // Microsoft's own redirect back, carrying either a code (success) or
    // an error param (the person cancelled, denied consent, etc. — never
    // reaches Microsoft's token endpoint, so there's no exchange to
    // attempt at all).
    @GetMapping("/callback")
    public ResponseEntity<Void> callback(@RequestParam String state, @RequestParam(required = false) String code,
                                          @RequestParam(required = false) String error) {
        if (error != null) {
            return redirect(microsoftSsoService.frontendErrorRedirect(state, "microsoft_" + error));
        }
        return redirect(microsoftSsoService.completeLogin(state, code));
    }

    private static ResponseEntity<Void> redirect(String location) {
        return ResponseEntity.status(HttpStatus.FOUND).header(HttpHeaders.LOCATION, location).build();
    }
}
