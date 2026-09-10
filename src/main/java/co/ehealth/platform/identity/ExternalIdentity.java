package co.ehealth.platform.identity;

import co.ehealth.platform.platform.SsoProviderType;
import jakarta.persistence.*;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "external_identities")
public class ExternalIdentity {
    @Id
    @GeneratedValue
    private UUID id;
    @Column(name = "user_id", nullable = false)
    private UUID userId;
    @Enumerated(EnumType.STRING)
    @Column(name = "provider_type", nullable = false, length = 10)
    private SsoProviderType providerType;
    @Column(nullable = false, length = 500)
    private String issuer;
    @Column(nullable = false, length = 500)
    private String subject;
    @Column(length = 200)
    private String email;
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    protected ExternalIdentity() {}

    public ExternalIdentity(UUID userId, SsoProviderType providerType, String issuer, String subject, String email) {
        this.userId = userId;
        this.providerType = providerType;
        this.issuer = issuer;
        this.subject = subject;
        this.email = email;
        this.createdAt = Instant.now();
    }

    public UUID getUserId() { return userId; }
}
