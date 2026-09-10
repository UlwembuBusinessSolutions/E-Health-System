package co.ehealth.platform.identity;

import co.ehealth.platform.core.security.JwtService;
import co.ehealth.platform.platform.TenantSsoService;
import co.ehealth.platform.platform.SamlResponseVerifier;
import co.ehealth.platform.core.tenant.TenantContext;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.constraints.NotBlank;
import org.springframework.http.ResponseEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.Objects;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/auth/sso")
public class SsoAuthController {
    private final TenantSsoService tenantSsoService;
    private final SamlResponseVerifier samlResponseVerifier;
    private final UserRepository userRepository;

    public SsoAuthController(TenantSsoService tenantSsoService, SamlResponseVerifier samlResponseVerifier,
                             UserRepository userRepository) {
        this.tenantSsoService = tenantSsoService;
        this.samlResponseVerifier = samlResponseVerifier;
        this.userRepository = userRepository;
    }

    @GetMapping("/policy")
    public ResponseEntity<AuthPolicyResponse> policy() {
        return ResponseEntity.ok(new AuthPolicyResponse(tenantSsoService.isSsoEnabled(),
                tenantSsoService.isNativeLoginAllowed(), tenantSsoService.providerName()));
    }

    @PostMapping("/start")
    public ResponseEntity<Map<String, String>> start(@RequestBody StartRequest request,
                                                       HttpServletRequest httpRequest) {
        String redirectUri = request.redirectUri() == null || request.redirectUri().isBlank()
                ? callbackUri(httpRequest)
                : request.redirectUri();
        return ResponseEntity.ok(Map.of("authorizationUrl", tenantSsoService.beginLogin(redirectUri)));
    }

    @GetMapping("/start")
    public ResponseEntity<Map<String, String>> startGet(HttpServletRequest request) {
        String redirectUri = callbackUri(request);
        return ResponseEntity.ok(Map.of("authorizationUrl", tenantSsoService.beginLogin(redirectUri)));
    }

    @GetMapping("/callback")
    public ResponseEntity<AuthController.LoginResponse> oidcCallback(
            @RequestParam @NotBlank String state, @RequestParam @NotBlank String code,
            HttpServletRequest request) {
        JwtService.IssuedToken issued = tenantSsoService.completeOidc(state, code, callbackUri(request));
        return response(issued);
    }

    @PostMapping("/callback")
    public ResponseEntity<AuthController.LoginResponse> oidcCallback(@RequestBody CallbackRequest callback) {
        JwtService.IssuedToken issued = tenantSsoService.completeOidc(callback.state(), callback.code(),
                callback.redirectUri());
        return response(issued);
    }

    @PostMapping("/saml/callback")
    public ResponseEntity<AuthController.LoginResponse> samlCallback(
            @RequestParam("SAMLResponse") @NotBlank String samlResponse,
            @RequestParam("RelayState") @NotBlank String relayState) {
        TenantSsoService.LoginState loginState = tenantSsoService.consumeSamlState(relayState);
            TenantContext.setCurrentTenant(loginState.tenantSchema());
            try {
                SamlResponseVerifier.Identity identity =
                        samlResponseVerifier.verify(samlResponse, tenantSsoService.samlSigningCertificate());
                JwtService.IssuedToken issued = tenantSsoService.completeSaml(identity.issuer(), identity.subject(),
                        identity.email(), identity.firstName(), identity.lastName());
                String handoff = tenantSsoService.createHandoff(issued);
                String separator = loginState.redirectUri().contains("?") ? "&" : "?";
                String redirect = loginState.redirectUri() + separator + "ssoCode=" + handoff;
                return ResponseEntity.status(HttpStatus.FOUND).header(HttpHeaders.LOCATION, redirect).build();
            } finally {
                TenantContext.clear();
            }
    }

    @PostMapping("/handoff")
    public ResponseEntity<AuthController.LoginResponse> handoff(@RequestBody HandoffRequest request) {
        return response(tenantSsoService.consumeHandoff(request.code()));
    }

    private ResponseEntity<AuthController.LoginResponse> response(JwtService.IssuedToken issued) {
        UUID userId = UUID.fromString(tenantSsoService.userIdFromToken(issued.token()));
        User user = userRepository.findById(Objects.requireNonNull(userId))
                .orElseThrow(() -> new IllegalStateException("SSO user could not be loaded."));
        return ResponseEntity.ok(new AuthController.LoginResponse(issued.token(), issued.expiresAt().toString(),
                new AuthController.UserSummary(user.getId(), user.getEmail(), user.getFirstName(), user.getLastName())));
    }

    private String callbackUri(HttpServletRequest request) {
        return request.getRequestURL().toString().replace("/start", "/callback");
    }

    public record StartRequest(String redirectUri) {}
    public record CallbackRequest(@NotBlank String state, @NotBlank String code, String redirectUri) {}
    public record HandoffRequest(@NotBlank String code) {}
    public record AuthPolicyResponse(boolean ssoEnabled, boolean passwordLoginEnabled, String providerName) {}
}
