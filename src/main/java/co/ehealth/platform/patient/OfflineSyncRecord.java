package co.ehealth.platform.patient;

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
import java.util.UUID;

// One row per offline-captured registration the server has ever seen.
// clientRecordId is the device-generated idempotency key. Plain UUID columns
// rather than @ManyToOne, same style as every other patient-linked entity here.
@Entity
@Table(name = "offline_sync_records")
public class OfflineSyncRecord {

    @Id
    @GeneratedValue
    private UUID id;

    @Column(name = "client_record_id", nullable = false, unique = true)
    private UUID clientRecordId;

    @Column(name = "device_id", nullable = false, length = 100)
    private String deviceId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private OfflineSyncStatus status;

    @Enumerated(EnumType.STRING)
    @Column(name = "conflict_type", length = 30)
    private OfflineConflictType conflictType;

    @Column(length = 500)
    private String message;

    // Raw JSON text, same String + SqlTypes.JSON pattern as AuditLog.beforeValue.
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(nullable = false)
    private String payload;

    @Column(name = "patient_id")
    private UUID patientId;

    @Column(name = "conflicting_patient_id")
    private UUID conflictingPatientId;

    // Device clock: untrusted, informational only.
    @Column(name = "captured_at", nullable = false)
    private Instant capturedAt;

    @Column(name = "submitted_by_user_id", nullable = false)
    private UUID submittedByUserId;

    // Server clock: authoritative.
    @Column(name = "received_at", nullable = false)
    private Instant receivedAt;

    @Enumerated(EnumType.STRING)
    @Column(length = 30)
    private SyncResolution resolution;

    @Column(name = "resolution_reason", columnDefinition = "TEXT")
    private String resolutionReason;

    @Column(name = "resolved_by_user_id")
    private UUID resolvedByUserId;

    @Column(name = "resolved_at")
    private Instant resolvedAt;

    protected OfflineSyncRecord() {
    }

    public OfflineSyncRecord(UUID clientRecordId, String deviceId, String payload, Instant capturedAt,
            UUID submittedByUserId, Instant receivedAt) {
        this.clientRecordId = clientRecordId;
        this.deviceId = deviceId;
        this.payload = payload;
        this.capturedAt = capturedAt;
        this.submittedByUserId = submittedByUserId;
        this.receivedAt = receivedAt;
    }

    // A REJECTED record being corrected and resent under the same
    // clientRecordId — replaces the stale payload before it is reprocessed.
    public void resubmit(String payload, Instant capturedAt, UUID submittedByUserId, Instant receivedAt) {
        this.payload = payload;
        this.capturedAt = capturedAt;
        this.submittedByUserId = submittedByUserId;
        this.receivedAt = receivedAt;
    }

    public void markSynced(UUID patientId) {
        this.status = OfflineSyncStatus.SYNCED;
        this.patientId = patientId;
        this.conflictType = null;
        this.conflictingPatientId = null;
        this.message = null;
    }

    public void markConflict(OfflineConflictType type, UUID conflictingPatientId, String message) {
        this.status = OfflineSyncStatus.CONFLICT;
        this.conflictType = type;
        this.conflictingPatientId = conflictingPatientId;
        this.message = message;
    }

    public void markRejected(String message) {
        this.status = OfflineSyncStatus.REJECTED;
        this.message = message;
    }

    public void resolve(SyncResolution resolution, String reason, UUID patientId, UUID resolvedByUserId,
            Instant resolvedAt) {
        this.status = OfflineSyncStatus.RESOLVED;
        this.resolution = resolution;
        this.resolutionReason = reason;
        this.patientId = patientId;
        this.resolvedByUserId = resolvedByUserId;
        this.resolvedAt = resolvedAt;
    }

    public UUID getId() {
        return id;
    }

    public UUID getClientRecordId() {
        return clientRecordId;
    }

    public String getDeviceId() {
        return deviceId;
    }

    public OfflineSyncStatus getStatus() {
        return status;
    }

    public OfflineConflictType getConflictType() {
        return conflictType;
    }

    public String getMessage() {
        return message;
    }

    public String getPayload() {
        return payload;
    }

    public UUID getPatientId() {
        return patientId;
    }

    public UUID getConflictingPatientId() {
        return conflictingPatientId;
    }

    public Instant getCapturedAt() {
        return capturedAt;
    }

    public UUID getSubmittedByUserId() {
        return submittedByUserId;
    }

    public Instant getReceivedAt() {
        return receivedAt;
    }

    public SyncResolution getResolution() {
        return resolution;
    }

    public String getResolutionReason() {
        return resolutionReason;
    }

    public UUID getResolvedByUserId() {
        return resolvedByUserId;
    }

    public Instant getResolvedAt() {
        return resolvedAt;
    }
}