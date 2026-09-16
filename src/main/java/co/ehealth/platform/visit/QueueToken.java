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

    @Column(name = "issued_by_user_id")
    private UUID issuedByUserId;

    @jakarta.persistence.Version
    private long version;
    @Column(name = "completed_at")
    private Instant completedAt;
    @Column(name = "stopped_at")
    private Instant stoppedAt;
    @Column(name = "cancelled_at")
    private Instant cancelledAt;
    @Enumerated(EnumType.STRING)
    @Column(name = "cancellation_reason", length = 40)
    private CancellationReason cancellationReason;

    public Instant getCompletedAt() { return completedAt; }
    public Instant getStoppedAt() { return stoppedAt; }
    public Instant getCancelledAt() { return cancelledAt; }
    public CancellationReason getCancellationReason() { return cancellationReason; }

    private void require(TokenStatus... allowed) {
        if (java.util.Arrays.stream(allowed).noneMatch(value -> value == status))
            throw new TokenTransitionException("Action is not allowed for token in " + status + " state");
    }
    public void startService() {
        require(TokenStatus.CALLED);
        status = TokenStatus.IN_SERVICE;
    }
    public void complete(Instant at) {
        require(TokenStatus.CALLED, TokenStatus.IN_SERVICE);
        status = TokenStatus.COMPLETED;
        completedAt = at;
    }
    public void stop(Instant at) {
        require(TokenStatus.ISSUED, TokenStatus.CALLED, TokenStatus.IN_SERVICE);
        status = TokenStatus.STOPPED;
        stoppedAt = at;
    }
    public void resume() {
        require(TokenStatus.STOPPED);
        status = TokenStatus.ISSUED;
        calledAt = null;
        stoppedAt = null;
    }
    public void cancel(Instant at, CancellationReason reason) {
        require(TokenStatus.ISSUED, TokenStatus.CALLED, TokenStatus.IN_SERVICE, TokenStatus.STOPPED);
        if (reason == null) throw new TokenTransitionException("A cancellation reason code is required");
        status = TokenStatus.CANCELLED;
        cancelledAt = at;
        cancellationReason = reason;
    }

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

    // RECQ-US-004 — "Called" status + call time recorded.
    public void call(Instant at) {
        require(TokenStatus.ISSUED);
        this.status = TokenStatus.CALLED;
        this.calledAt = at;
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

    public UUID getIssuedByUserId() {
        return issuedByUserId;
    }
}
