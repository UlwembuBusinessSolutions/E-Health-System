package co.ehealth.platform.identity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "password_reset_tokens")
public class PasswordResetToken {

    @Id
    @GeneratedValue
    private UUID id;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(name = "code_hash", nullable = false)
    private String codeHash;

    @Column(name = "expires_at", nullable = false)
    private Instant expiresAt;

    @Column(name = "attempt_count", nullable = false)
    private int attemptCount = 0;

    @Column(name = "consumed_at")
    private Instant consumedAt;

    @Column(name = "requested_ip")
    private String requestedIp;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    protected PasswordResetToken() {
    }

    public PasswordResetToken(UUID userId, String codeHash, Instant expiresAt, String requestedIp) {
        this.userId = userId;
        this.codeHash = codeHash;
        this.expiresAt = expiresAt;
        this.requestedIp = requestedIp;
        this.createdAt = Instant.now();
    }

    public boolean isExpired(Instant now) {
        return now.isAfter(expiresAt);
    }

    public void incrementAttempts() {
        this.attemptCount++;
    }

    public void markConsumed(Instant at) {
        this.consumedAt = at;
    }

    public String getCodeHash() {
        return codeHash;
    }

    public int getAttemptCount() {
        return attemptCount;
    }

    public UUID getUserId() {
        return userId;
    }
}
