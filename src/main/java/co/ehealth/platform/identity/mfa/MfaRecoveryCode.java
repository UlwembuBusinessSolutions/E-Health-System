package co.ehealth.platform.identity.mfa;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "mfa_recovery_codes")
public class MfaRecoveryCode {
    @Id
    @GeneratedValue
    UUID id;
    @Column(name = "user_id", nullable = false)
    UUID userId;
    @Column(name = "code_hash", nullable = false)
    String codeHash;
    @Column(name = "used_at")
    Instant usedAt;
    @Column(name = "created_at", nullable = false)
    Instant createdAt;

    protected MfaRecoveryCode() {
    }

    MfaRecoveryCode(UUID userId, String hash, Instant now) {
        this.userId = userId;
        this.codeHash = hash;
        this.createdAt = now;
    }
}