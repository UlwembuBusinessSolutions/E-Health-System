package co.ehealth.platform.platform;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "platform_password_reset_tokens", schema = "control")
public class PlatformPasswordResetToken {

    @Id
    @GeneratedValue
    private UUID id;

    @Column(name = "operator_id", nullable = false)
    private UUID operatorId;

    @Column(name = "token_hash", nullable = false)
    private String tokenHash;

    @Column(name = "expires_at", nullable = false)
    private Instant expiresAt;

    @Column(name = "consumed_at")
    private Instant consumedAt;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    protected PlatformPasswordResetToken() {
    }

    public PlatformPasswordResetToken(UUID operatorId, String tokenHash, Instant expiresAt, Instant createdAt) {
        this.operatorId = operatorId;
        this.tokenHash = tokenHash;
        this.expiresAt = expiresAt;
        this.createdAt = createdAt;
    }

    public boolean isUsable(Instant now) {
        return consumedAt == null && now.isBefore(expiresAt);
    }

    public void consume(Instant at) {
        consumedAt = at;
    }

    public UUID getOperatorId() { return operatorId; }
    public String getTokenHash() { return tokenHash; }
}
