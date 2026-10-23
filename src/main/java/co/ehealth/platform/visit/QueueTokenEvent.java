package co.ehealth.platform.visit;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

// The normalized history V20's wide nullable columns on QueueToken
// couldn't provide (QueueToken's own why-note, and V21's migration
// comment) — one immutable row per transition, rather than a handful of
// columns a later transition can silently overwrite. Never updated after
// insert: QueueService.recordEvent() only ever creates one of these, never
// mutates an existing row.
@Entity
@Table(name = "queue_token_events")
public class QueueTokenEvent {

    @Id
    @GeneratedValue
    private UUID id;

    @Column(name = "token_id", nullable = false)
    private UUID tokenId;

    @Enumerated(EnumType.STRING)
    @Column(name = "event_type", nullable = false, length = 30)
    private QueueTokenEventType eventType;

    @Enumerated(EnumType.STRING)
    @Column(name = "from_status", length = 20)
    private TokenStatus fromStatus;

    @Enumerated(EnumType.STRING)
    @Column(name = "to_status", length = 20)
    private TokenStatus toStatus;

    @Enumerated(EnumType.STRING)
    @Column(name = "from_priority", length = 20)
    private TokenPriority fromPriority;

    @Enumerated(EnumType.STRING)
    @Column(name = "to_priority", length = 20)
    private TokenPriority toPriority;

    @Enumerated(EnumType.STRING)
    @Column(name = "reason_code", length = 40)
    private QueueActionReason reasonCode;

    @Column(name = "reason_note")
    private String reasonNote;

    @Column(name = "performed_by_user_id")
    private UUID performedByUserId;

    @Column(name = "occurred_at", nullable = false)
    private Instant occurredAt;

    protected QueueTokenEvent() {
    }

    public QueueTokenEvent(UUID tokenId, QueueTokenEventType eventType, TokenStatus fromStatus, TokenStatus toStatus,
                            TokenPriority fromPriority, TokenPriority toPriority, QueueActionReason reasonCode,
                            String reasonNote, UUID performedByUserId, Instant occurredAt) {
        this.tokenId = tokenId;
        this.eventType = eventType;
        this.fromStatus = fromStatus;
        this.toStatus = toStatus;
        this.fromPriority = fromPriority;
        this.toPriority = toPriority;
        this.reasonCode = reasonCode;
        this.reasonNote = reasonNote;
        this.performedByUserId = performedByUserId;
        this.occurredAt = occurredAt;
    }

    public UUID getId() {
        return id;
    }

    public UUID getTokenId() {
        return tokenId;
    }

    public QueueTokenEventType getEventType() {
        return eventType;
    }

    public TokenStatus getFromStatus() {
        return fromStatus;
    }

    public TokenStatus getToStatus() {
        return toStatus;
    }

    public TokenPriority getFromPriority() {
        return fromPriority;
    }

    public TokenPriority getToPriority() {
        return toPriority;
    }

    public QueueActionReason getReasonCode() {
        return reasonCode;
    }

    public String getReasonNote() {
        return reasonNote;
    }

    public UUID getPerformedByUserId() {
        return performedByUserId;
    }

    public Instant getOccurredAt() {
        return occurredAt;
    }
}
