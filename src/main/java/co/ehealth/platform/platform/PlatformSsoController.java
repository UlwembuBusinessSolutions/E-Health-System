package co.ehealth.platform.platform;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/platform/organizations/{organizationId}/sso")
public class PlatformSsoController {
    private final TenantSsoConfigurationRepository repository;

    public PlatformSsoController(TenantSsoConfigurationRepository repository) {
        this.repository = repository;
    }

    @GetMapping
    public ResponseEntity<SsoConfigurationResponse> get(@PathVariable UUID organizationId) {
        return ResponseEntity.ok(repository.findByOrganizationId(organizationId)
                .map(SsoConfigurationResponse::from)
                .orElseGet(() -> SsoConfigurationResponse.disabled()));
    }

    @PutMapping
    public ResponseEntity<SsoConfigurationResponse> put(@PathVariable UUID organizationId,
                                                         @Valid @RequestBody SsoConfigurationRequest request,
                                                         @AuthenticationPrincipal Object ignored) {
        TenantSsoConfiguration configuration = repository.findByOrganizationId(organizationId)
                .orElseGet(() -> new TenantSsoConfiguration(organizationId, request.providerType()));
        if (configuration.getProviderType() != request.providerType()) {
            throw new IllegalArgumentException("Changing SSO provider type requires deleting the existing configuration.");
        }
        configuration.update(request.enabled(), request.allowNativeLogin(), request.defaultRole(), request.issuer(), request.clientId(),
                request.clientSecret(), request.authorizationEndpoint(), request.tokenEndpoint(),
                request.userinfoEndpoint(), request.jwksUri(), request.entityId(), request.ssoUrl(),
                request.signingCertificate(), request.attributeMapping());
        return ResponseEntity.ok(SsoConfigurationResponse.from(repository.save(configuration)));
    }

    @DeleteMapping
    public ResponseEntity<Void> delete(@PathVariable UUID organizationId) {
        repository.findByOrganizationId(organizationId).ifPresent(repository::delete);
        return ResponseEntity.noContent().build();
    }

    public record SsoConfigurationRequest(@NotNull SsoProviderType providerType, boolean enabled,
                                          boolean allowNativeLogin, String defaultRole, String issuer, String clientId,
                                          String clientSecret, String authorizationEndpoint, String tokenEndpoint,
                                          String userinfoEndpoint, String jwksUri, String entityId, String ssoUrl,
                                          String signingCertificate, Map<String, String> attributeMapping) {}

    public record SsoConfigurationResponse(UUID id, SsoProviderType providerType, boolean enabled,
                                           boolean allowNativeLogin, String defaultRole, String issuer, String clientId,
                                           String authorizationEndpoint, String tokenEndpoint, String userinfoEndpoint,
                                           String jwksUri, String entityId, String ssoUrl,
                                           Map<String, String> attributeMapping) {
        static SsoConfigurationResponse from(TenantSsoConfiguration c) {
            return new SsoConfigurationResponse(c.getId(), c.getProviderType(), c.isEnabled(),
                    c.isAllowNativeLogin(), c.getDefaultRole(), c.getIssuer(), c.getClientId(), c.getAuthorizationEndpoint(),
                    c.getTokenEndpoint(), c.getUserinfoEndpoint(), c.getJwksUri(), c.getEntityId(), c.getSsoUrl(),
                    c.getAttributeMapping());
        }
        static SsoConfigurationResponse disabled() {
            return new SsoConfigurationResponse(null, null, false, true, "Admin Staff", null, null, null, null, null,
                    null, null, null, Map.of());
        }
    }
}
