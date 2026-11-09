package co.ehealth.platform.patient;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "patient_password_reset_tokens")
public class PatientPasswordResetToken {
    @Id
    @GeneratedValue
    private UUID id;

    @Column(name = "patient_account_id", nullable = false)
    private UUID patientAccountId;

    @Column(name = "code_hash", nullable = false, length = 100)
    private String codeHash;

    @Column(name = "expires_at", nullable = false)
    private Instant expiresAt;

    @Column(name = "attempt_count", nullable = false)
    private int attemptCount;

    @Column(name = "consumed_at")
    private Instant consumedAt;

    @Column(name = "requested_ip", length = 64)
    private String requestedIp;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    protected PatientPasswordResetToken() { }

    public PatientPasswordResetToken(UUID patientAccountId, String codeHash, Instant expiresAt,
                                     String requestedIp, Instant createdAt) {
        this.patientAccountId = patientAccountId;
        this.codeHash = codeHash;
        this.expiresAt = expiresAt;
        this.requestedIp = requestedIp;
        this.createdAt = createdAt;
    }

    public boolean isExpired(Instant now) { return !now.isBefore(expiresAt); }
    public void incrementAttempts() { attemptCount++; }
    public void markConsumed(Instant at) { consumedAt = at; }
    public String getCodeHash() { return codeHash; }
    public int getAttemptCount() { return attemptCount; }
    public Instant getCreatedAt() { return createdAt; }
}
