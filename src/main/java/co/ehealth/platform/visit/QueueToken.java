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

// RECQ-US-001/002's QueueToken — facilityId is denormalized from the
// parent Visit (not just visitId) so QueueService's own per-facility
// queries (list the active queue, call next) don't need a join for the one
// filter they always apply. tokenNumber resets daily per facility, not a
// real Postgres sequence — QueueService.nextTokenNumber()'s own why-note on
// why a plain count-and-increment is an accepted trade-off here, unlike
// PatientService's MPI generation which genuinely needs sequence-level
// concurrency safety.
@Entity
@Table(name = "queue_tokens")
public class QueueToken {

    @Id
    @GeneratedValue
    private UUID id;

    @Column(name = "visit_id", nullable = false)
    private UUID visitId;

    @Column(name = "facility_id", nullable = false)
    private UUID facilityId;

    @Column(name = "token_number", nullable = false)
    private int tokenNumber;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private TokenPriority priority;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private TokenStatus status;

    // RECQ-US-002's "flagged manual for reporting" — the only functional
    // difference between the automatic and manual issuance paths; nothing
    // about queue ordering or calling treats the two differently.
    @Column(name = "is_manual", nullable = false)
    private boolean manual;

    @Column(name = "issued_at", nullable = false)
    private Instant issuedAt;

    @Column(name = "called_at")
    private Instant calledAt;

    @Column(name = "missed_at")
    private Instant missedAt;

    @Column(name = "completed_at")
    private Instant completedAt;

    @Column(name = "cancelled_at")
    private Instant cancelledAt;

    @Column(name = "cancel_reason")
    private String cancelReason;

    @Column(name = "cancelled_by_user_id")
    private UUID cancelledByUserId;

    @Column(name = "issued_by_user_id")
    private UUID issuedByUserId;

    protected QueueToken() {
    }

    public QueueToken(UUID visitId, UUID facilityId, int tokenNumber, TokenPriority priority, boolean manual,
                       Instant issuedAt, UUID issuedByUserId) {
        this.visitId = visitId;
        this.facilityId = facilityId;
        this.tokenNumber = tokenNumber;
        this.priority = priority;
        this.status = TokenStatus.ISSUED;
        this.manual = manual;
        this.issuedAt = issuedAt;
        this.issuedByUserId = issuedByUserId;
    }

    // Boosting (or demoting) priority in place — deliberately does NOT touch
    // issuedAt or status, unlike issuing a fresh manual token: bumping an
    // already-waiting patient to PRIORITY should move them up the existing
    // queue, not spawn a second row for the same visit sitting alongside
    // the original. Blocked once the token is resolved (COMPLETED/
    // CANCELLED) — nothing about a closed-out token's priority still
    // matters.
    public void updatePriority(TokenPriority priority) {
        if (status == TokenStatus.COMPLETED || status == TokenStatus.CANCELLED) {
            throw new InvalidTokenTransitionException(status);
        }
        this.priority = priority;
    }

    // RECQ-US-004 — "Called" status + call time recorded.
    public void call(Instant at) {
        this.status = TokenStatus.CALLED;
        this.calledAt = at;
    }

    // The patient didn't respond to the call — a nurse/marshall flags it
    // rather than the token silently sitting as CALLED forever. Only valid
    // from CALLED: you can't miss a call that never happened.
    public void markMissed(Instant at) {
        requireStatus(TokenStatus.CALLED, TokenStatus.MISSED);
        this.status = TokenStatus.MISSED;
        this.missedAt = at;
    }

    // The out-and-back recall (queue-appointments-plan.md §3.8) — moves
    // straight back to ISSUED without touching priority or issuedAt, so a
    // patient who stepped out regains exactly the place they'd have had if
    // they'd never missed the call. Only valid from MISSED.
    public void recall() {
        requireStatus(TokenStatus.MISSED, TokenStatus.ISSUED);
        this.status = TokenStatus.ISSUED;
    }

    // RECQ-US-005 — service finished. Only valid from CALLED: a token has
    // to have actually been called before it can be marked complete.
    public void complete(Instant at) {
        requireStatus(TokenStatus.CALLED, TokenStatus.COMPLETED);
        this.status = TokenStatus.COMPLETED;
        this.completedAt = at;
    }

    // RECQ-US-005 — cancellable from any non-terminal state (ISSUED,
    // CALLED, or MISSED), always with a mandatory reason for the audit
    // trail. COMPLETED/CANCELLED are terminal: reopening either would
    // rewrite history rather than record a new fact.
    public void cancel(Instant at, String reason, UUID cancelledByUserId) {
        if (status == TokenStatus.COMPLETED || status == TokenStatus.CANCELLED) {
            throw new InvalidTokenTransitionException(status, TokenStatus.CANCELLED);
        }
        this.status = TokenStatus.CANCELLED;
        this.cancelledAt = at;
        this.cancelReason = reason;
        this.cancelledByUserId = cancelledByUserId;
    }

    private void requireStatus(TokenStatus required, TokenStatus target) {
        if (status != required) {
            throw new InvalidTokenTransitionException(status, target);
        }
    }

    public UUID getId() {
        return id;
    }

    public UUID getVisitId() {
        return visitId;
    }

    public UUID getFacilityId() {
        return facilityId;
    }

    public int getTokenNumber() {
        return tokenNumber;
    }

    public TokenPriority getPriority() {
        return priority;
    }

    public TokenStatus getStatus() {
        return status;
    }

    public boolean isManual() {
        return manual;
    }

    public Instant getIssuedAt() {
        return issuedAt;
    }

    public Instant getCalledAt() {
        return calledAt;
    }

    public Instant getMissedAt() {
        return missedAt;
    }

    public Instant getCompletedAt() {
        return completedAt;
    }

    public Instant getCancelledAt() {
        return cancelledAt;
    }

    public String getCancelReason() {
        return cancelReason;
    }

    public UUID getCancelledByUserId() {
        return cancelledByUserId;
    }

    public UUID getIssuedByUserId() {
        return issuedByUserId;
    }
}
