package co.ehealth.platform.identity.mfa;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "user_mfa")
public class UserMfa {
    public enum Status {
        PENDING, ACTIVE
    }

    @Id
    @Column(name = "user_id")
    UUID userId;
    @Column(name = "secret_encrypted", nullable = false)
    String secretEncrypted;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    Status status;
    @Column(name = "last_used_step", nullable = false)
    long lastUsedStep;
    @Column(name = "failed_attempts", nullable = false)
    int failedAttempts;
    @Column(name = "enrolled_at")
    Instant enrolledAt;
    @Column(name = "created_at", nullable = false)
    Instant createdAt;

    protected UserMfa() {
    }

    UserMfa(UUID userId, Instant now) {
        this.userId = userId;
        this.status = Status.PENDING;
        this.createdAt = now;
    }
}