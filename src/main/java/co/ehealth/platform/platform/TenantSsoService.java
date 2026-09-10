package co.ehealth.platform.platform;

import co.ehealth.platform.core.security.JwtService;
import co.ehealth.platform.core.tenant.TenantContext;
import co.ehealth.platform.identity.ExternalIdentity;
import co.ehealth.platform.identity.ExternalIdentityRepository;
import co.ehealth.platform.identity.RoleRepository;
import co.ehealth.platform.identity.User;
import co.ehealth.platform.identity.UserRepository;
import co.ehealth.platform.core.tenant.OrganizationRepository;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.web.client.RestClient;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class TenantSsoService {
    private static final Duration STATE_TTL = Duration.ofMinutes(10);
    private final TenantSsoConfigurationRepository configurationRepository;
    private final OrganizationRepository organizationRepository;
    private final UserRepository userRepository;
    private final ExternalIdentityRepository externalIdentityRepository;
    private final RoleRepository roleRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final RestClient restClient;
    private final SecureRandom random = new SecureRandom();
    private final Map<String, LoginState> states = new ConcurrentHashMap<>();
    private final Map<String, Handoff> handoffs = new ConcurrentHashMap<>();

    public TenantSsoService(TenantSsoConfigurationRepository configurationRepository,
                            OrganizationRepository organizationRepository, UserRepository userRepository,
                            ExternalIdentityRepository externalIdentityRepository, RoleRepository roleRepository,
                            PasswordEncoder passwordEncoder, JwtService jwtService,
                            RestClient.Builder restClientBuilder) {
        this.configurationRepository = configurationRepository;
        this.organizationRepository = organizationRepository;
        this.userRepository = userRepository;
        this.externalIdentityRepository = externalIdentityRepository;
        this.roleRepository = roleRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
        this.restClient = restClientBuilder.build();
    }

    public boolean isNativeLoginAllowed() {
        return currentConfiguration().map(configuration -> configuration.isAllowNativeLogin()).orElse(true);
    }

    public boolean isSsoEnabled() {
        return currentConfiguration().map(configuration -> configuration.isEnabled()).orElse(false);
    }

    public String providerName() {
        return currentConfiguration().filter(configuration -> configuration.isEnabled())
                .map(configuration -> configuration.getProviderType().name()).orElse(null);
    }

    public String userIdFromToken(String token) {
        return jwtService.parseAndValidate(token).getSubject();
    }

    public String beginLogin(String redirectUri) {
        TenantSsoConfiguration configuration = requireEnabledConfiguration();
        if (configuration.getProviderType() != SsoProviderType.OIDC) {
            return beginSamlLogin(redirectUri);
        }

        String state = randomState();
        states.put(state, new LoginState(TenantContext.getCurrentTenant(), redirectUri,
                Instant.now().plus(STATE_TTL)));
        String query = "response_type=code&client_id=" + encode(configuration.getClientId())
                + "&redirect_uri=" + encode(redirectUri)
                + "&scope=" + encode("openid profile email")
                + "&state=" + encode(state);
        return configuration.getAuthorizationEndpoint() + (configuration.getAuthorizationEndpoint().contains("?") ? "&" : "?") + query;
    }

    public String beginSamlLogin(String redirectUri) {
        TenantSsoConfiguration configuration = requireEnabledConfiguration();
        if (configuration.getProviderType() != SsoProviderType.SAML) {
            throw new IllegalStateException("Configured provider is not SAML.");
        }
        String state = randomState();
        states.put(state, new LoginState(TenantContext.getCurrentTenant(), redirectUri,
                Instant.now().plus(STATE_TTL)));
        String separator = configuration.getSsoUrl().contains("?") ? "&" : "?";
        return configuration.getSsoUrl() + separator + "RelayState=" + encode(state);
    }

    public LoginState consumeSamlState(String state) {
        LoginState loginState = states.remove(state);
        if (loginState == null || loginState.expiresAt().isBefore(Instant.now())
                || loginState.tenantSchema() == null) {
            throw new IllegalArgumentException("SAML state is invalid or expired.");
        }
        return loginState;
    }

    public String createHandoff(JwtService.IssuedToken issued) {
        String code = randomState();
        handoffs.put(code, new Handoff(issued, Instant.now().plus(Duration.ofMinutes(1))));
        return code;
    }

    public JwtService.IssuedToken consumeHandoff(String code) {
        Handoff handoff = handoffs.remove(code);
        if (handoff == null || handoff.expiresAt().isBefore(Instant.now())) {
            throw new IllegalArgumentException("SSO handoff is invalid or expired.");
        }
        return handoff.issued();
    }

    @Transactional
    public JwtService.IssuedToken completeOidc(String state, String code, String redirectUri) {
        LoginState loginState = states.remove(state);
        if (loginState == null || loginState.expiresAt().isBefore(Instant.now())
                || !loginState.tenantSchema().equals(TenantContext.getCurrentTenant())
                || !loginState.redirectUri().equals(redirectUri)) {
            throw new IllegalArgumentException("SSO state is invalid or expired.");
        }
        TenantSsoConfiguration configuration = requireEnabledConfiguration();
        if (configuration.getProviderType() != SsoProviderType.OIDC) {
            throw new IllegalArgumentException("Configured provider is not OIDC.");
        }
        LinkedMultiValueMap<String, String> form = new LinkedMultiValueMap<>();
        form.add("grant_type", "authorization_code");
        form.add("code", code);
        form.add("client_id", configuration.getClientId());
        form.add("client_secret", configuration.getClientSecret());
        form.add("redirect_uri", redirectUri);
        Map<String, Object> token = restClient.post().uri(Objects.requireNonNull(configuration.getTokenEndpoint()))
                .contentType(Objects.requireNonNull(MediaType.APPLICATION_FORM_URLENCODED)).body(form).retrieve()
                .body(new ParameterizedTypeReference<>() {});
        if (token == null || token.get("id_token") == null) {
            throw new IllegalArgumentException("Identity provider did not return an ID token.");
        }
        Jwt jwt = decodeAndValidate((String) token.get("id_token"), configuration);
        String subject = jwt.getSubject();
        String email = first(jwt, configuration, "email");
        if (subject == null || email == null || !Boolean.TRUE.equals(jwt.getClaim("email_verified"))) {
            throw new IllegalArgumentException("OIDC identity must contain a verified email and subject.");
        }
        return issueForExternalIdentity(SsoProviderType.OIDC, configuration.getIssuer(), subject, email,
                first(jwt, configuration, "given_name"), first(jwt, configuration, "family_name"));
    }

    @Transactional
    public JwtService.IssuedToken completeSaml(String issuer, String subject, String email,
                                                String firstName, String lastName) {
        TenantSsoConfiguration configuration = requireEnabledConfiguration();
        if (configuration.getProviderType() != SsoProviderType.SAML
                || !configuration.getEntityId().equals(issuer)) {
            throw new IllegalArgumentException("SAML identity provider is not configured for this tenant.");
        }
        if (subject == null || email == null) {
            throw new IllegalArgumentException("SAML assertion must contain a subject and email.");
        }
        return issueForExternalIdentity(SsoProviderType.SAML, issuer, subject, email, firstName, lastName);
    }

    public String samlSigningCertificate() {
        return requireEnabledConfiguration().getSigningCertificate();
    }

    private Jwt decodeAndValidate(String token, TenantSsoConfiguration configuration) {
        if (configuration.getJwksUri() == null || configuration.getIssuer() == null) {
            throw new IllegalArgumentException("OIDC JWKS and issuer are required.");
        }
        JwtDecoder decoder = NimbusJwtDecoder.withJwkSetUri(configuration.getJwksUri()).build();
        Jwt jwt = decoder.decode(token);
        if (!configuration.getIssuer().equals(jwt.getIssuer())
                || !configuration.getClientId().equals(jwt.getAudience().stream().findFirst().orElse(null))) {
            throw new IllegalArgumentException("OIDC token issuer or audience is invalid.");
        }
        return jwt;
    }

    private String first(Jwt jwt, TenantSsoConfiguration configuration, String standardClaim) {
        String claim = configuration.getAttributeMapping().getOrDefault(standardClaim, standardClaim);
        Object value = jwt.getClaims().get(claim);
        return value == null ? null : value.toString();
    }

    private JwtService.IssuedToken issueForExternalIdentity(SsoProviderType provider, String issuer,
                                                             String subject, String email, String firstName,
                                                             String lastName) {
        User user = externalIdentityRepository.findByProviderTypeAndIssuerAndSubject(provider, issuer, subject)
                .map(identity -> userRepository.findById(Objects.requireNonNull(identity.getUserId()))
                        .orElseThrow(() -> new IllegalArgumentException("Linked tenant user no longer exists.")))
                .orElseGet(() -> userRepository.findByEmail(email).orElseGet(
                        () -> createJitUser(email, firstName, lastName)));
        if (user.getStatus() != co.ehealth.platform.identity.UserStatus.ACTIVE) {
            throw new IllegalArgumentException("This tenant user is not active.");
        }
        if (externalIdentityRepository.findByProviderTypeAndIssuerAndSubject(provider, issuer, subject).isEmpty()) {
            externalIdentityRepository.save(new ExternalIdentity(user.getId(), provider, issuer, subject, email));
        }
        return jwtService.issue(user.getId(), TenantContext.getCurrentTenant(),
                userRepository.findRoleNames(user.getId()), user.getTokenVersion());
    }

    private User createJitUser(String email, String firstName, String lastName) {
        String id = UUID.randomUUID().toString().replace("-", "");
        User user = new User("sso-" + id.substring(0, 20), email,
                firstName == null || firstName.isBlank() ? "SSO" : firstName,
                lastName == null || lastName.isBlank() ? "User" : lastName,
                "sso" + id.substring(0, 17), passwordEncoder.encode(id), null, null);
        user.markEmailVerified(Instant.now());
        userRepository.save(user);
        currentConfiguration().flatMap(configuration -> roleRepository.findByName(configuration.getDefaultRole())).ifPresent(role ->
                userRepository.assignRole(user.getId(), role.getId(), null));
        return user;
    }

    private TenantSsoConfiguration requireEnabledConfiguration() {
        TenantSsoConfiguration configuration = currentConfiguration()
                .orElseThrow(() -> new IllegalStateException("SSO is not configured for this tenant."));
        if (!configuration.isEnabled()) {
            throw new IllegalStateException("SSO is disabled for this tenant.");
        }
        return configuration;
    }

    private java.util.Optional<TenantSsoConfiguration> currentConfiguration() {
        return organizationRepository.findBySchemaName(TenantContext.getCurrentTenant())
                .flatMap(org -> configurationRepository.findByOrganizationId(org.getId()));
    }

    private String randomState() {
        byte[] bytes = new byte[32];
        random.nextBytes(bytes);
        return java.util.HexFormat.of().formatHex(bytes);
    }

    private String encode(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8);
    }

    public record LoginState(String tenantSchema, String redirectUri, Instant expiresAt) {}
    private record Handoff(JwtService.IssuedToken issued, Instant expiresAt) {}
}
