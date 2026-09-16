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
