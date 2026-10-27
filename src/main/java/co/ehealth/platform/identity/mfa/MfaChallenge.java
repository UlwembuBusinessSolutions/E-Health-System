package co.ehealth.platform.identity.mfa;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "mfa_challenges")
public class MfaChallenge {
    public enum Purpose {
        VERIFY, ENROL
    }

    @Id
    @GeneratedValue
    UUID id;
    @Column(name = "token_hash", nullable = false, unique = true)
    String tokenHash;
    @Column(name = "user_id", nullable = false)
    UUID userId;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    Purpose purpose;
    @Column(name = "attempt_count", nullable = false)
    int attemptCount;
    @Column(name = "expires_at", nullable = false)
    Instant expiresAt;
    @Column(name = "consumed_at")
    Instant consumedAt;
    @Column(name = "created_at", nullable = false)
    Instant createdAt;

    protected MfaChallenge() {
    }

    MfaChallenge(String hash, UUID userId, Purpose purpose, Instant expiresAt, Instant now) {
        this.tokenHash = hash;
        this.userId = userId;
        this.purpose = purpose;
        this.expiresAt = expiresAt;
        this.createdAt = now;
    }

    public UUID getUserId() {
        return userId;
    }
}