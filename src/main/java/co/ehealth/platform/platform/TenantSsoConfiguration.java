package co.ehealth.platform.platform;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

@Entity
@Table(name = "tenant_sso_configurations", schema = "control")
public class TenantSsoConfiguration {
    @Id
    @GeneratedValue
    private UUID id;

    @Column(name = "organization_id", nullable = false, unique = true)
    private UUID organizationId;

    @Enumerated(EnumType.STRING)
    @Column(name = "provider_type", nullable = false, length = 10)
    private SsoProviderType providerType;

    @Column(nullable = false)
    private boolean enabled = false;

    @Column(name = "allow_native_login", nullable = false)
    private boolean allowNativeLogin = true;
    @Column(name = "default_role", nullable = false, length = 100)
    private String defaultRole = "Admin Staff";

    @Column(length = 500)
    private String issuer;
    @Column(name = "client_id", length = 500)
    private String clientId;
    @JsonIgnore
    @Column(name = "client_secret")
    private String clientSecret;
    @Column(name = "authorization_endpoint", length = 1000)
    private String authorizationEndpoint;
    @Column(name = "token_endpoint", length = 1000)
    private String tokenEndpoint;
    @Column(name = "userinfo_endpoint", length = 1000)
    private String userinfoEndpoint;
    @Column(name = "jwks_uri", length = 1000)
    private String jwksUri;
    @Column(name = "entity_id", length = 1000)
    private String entityId;
    @Column(name = "sso_url", length = 1000)
    private String ssoUrl;
    @Column(name = "signing_certificate")
    private String signingCertificate;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "attribute_mapping", columnDefinition = "jsonb", nullable = false)
    private Map<String, String> attributeMapping = Map.of();

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected TenantSsoConfiguration() {
    }

    public TenantSsoConfiguration(UUID organizationId, SsoProviderType providerType) {
        this.organizationId = organizationId;
        this.providerType = providerType;
        this.createdAt = Instant.now();
        this.updatedAt = this.createdAt;
    }

    public void update(boolean enabled, boolean allowNativeLogin, String defaultRole, String issuer, String clientId,
                       String clientSecret, String authorizationEndpoint, String tokenEndpoint,
                       String userinfoEndpoint, String jwksUri, String entityId, String ssoUrl,
                       String signingCertificate, Map<String, String> attributeMapping) {
        this.enabled = enabled;
        this.allowNativeLogin = allowNativeLogin;
        if (defaultRole != null && !defaultRole.isBlank()) {
            this.defaultRole = defaultRole;
        }
        this.issuer = issuer;
        this.clientId = clientId;
        if (clientSecret != null && !clientSecret.isBlank()) {
            this.clientSecret = clientSecret;
        }
        this.authorizationEndpoint = authorizationEndpoint;
        this.tokenEndpoint = tokenEndpoint;
        this.userinfoEndpoint = userinfoEndpoint;
        this.jwksUri = jwksUri;
        this.entityId = entityId;
        this.ssoUrl = ssoUrl;
        this.signingCertificate = signingCertificate;
        this.attributeMapping = attributeMapping == null ? Map.of() : Map.copyOf(attributeMapping);
        this.updatedAt = Instant.now();
    }

    public UUID getId() { return id; }
    public UUID getOrganizationId() { return organizationId; }
    public SsoProviderType getProviderType() { return providerType; }
    public boolean isEnabled() { return enabled; }
    public boolean isAllowNativeLogin() { return allowNativeLogin; }
    public String getDefaultRole() { return defaultRole; }
    public String getIssuer() { return issuer; }
    public String getClientId() { return clientId; }
    public String getClientSecret() { return clientSecret; }
    public String getAuthorizationEndpoint() { return authorizationEndpoint; }
    public String getTokenEndpoint() { return tokenEndpoint; }
    public String getUserinfoEndpoint() { return userinfoEndpoint; }
    public String getJwksUri() { return jwksUri; }
    public String getEntityId() { return entityId; }
    public String getSsoUrl() { return ssoUrl; }
    public String getSigningCertificate() { return signingCertificate; }
    public Map<String, String> getAttributeMapping() { return attributeMapping; }
}
