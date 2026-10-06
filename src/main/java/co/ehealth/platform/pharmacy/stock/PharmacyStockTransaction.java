package co.ehealth.platform.pharmacy.stock;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

// One posting event — plan section 7. Never updated after insert (rule 2
// of the plan's non-negotiable stock rules); corrections are a separate
// REVERSAL transaction linking back via reversalOfTransactionId (Phase 2).
// idempotencyKey is always populated, client-supplied or server-derived
// from actor+operation+body hash (PharmacyStockLedgerService's own
// why-note) — a retried request with the same key AND bodyHash returns the
// original result instead of posting twice; a reused key with a different
// bodyHash is rejected outright.
@Entity
@Table(name = "pharmacy_stock_transactions")
public class PharmacyStockTransaction {

    @Id
    @GeneratedValue
    private UUID id;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private StockTransactionType type;

    @Column(name = "facility_id", nullable = false)
    private UUID facilityId;

    @Column(name = "actor_user_id", nullable = false)
    private UUID actorUserId;

    // Recorded name at posting time, deliberately not just a User FK — plan
    // section 7: "Preserve historical attribution after renaming/offboarding
    // staff."
    @Column(name = "actor_name", nullable = false, length = 200)
    private String actorName;

    @Column(length = 500)
    private String reason;

    @Column(name = "source_reference", length = 200)
    private String sourceReference;

    @Column(name = "idempotency_key", nullable = false, length = 128)
    private String idempotencyKey;

    @Column(name = "body_hash", nullable = false, length = 128)
    private String bodyHash;

    @Column(name = "reversal_of_transaction_id")
    private UUID reversalOfTransactionId;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    protected PharmacyStockTransaction() {
    }

    public PharmacyStockTransaction(StockTransactionType type, UUID facilityId, UUID actorUserId, String actorName,
                                     String reason, String sourceReference, String idempotencyKey, String bodyHash,
                                     UUID reversalOfTransactionId, Instant createdAt) {
        this.type = type;
        this.facilityId = facilityId;
        this.actorUserId = actorUserId;
        this.actorName = actorName;
        this.reason = reason;
        this.sourceReference = sourceReference;
        this.idempotencyKey = idempotencyKey;
        this.bodyHash = bodyHash;
        this.reversalOfTransactionId = reversalOfTransactionId;
        this.createdAt = createdAt;
    }

    public UUID getId() {
        return id;
    }

    public StockTransactionType getType() {
        return type;
    }

    public UUID getFacilityId() {
        return facilityId;
    }

    public UUID getActorUserId() {
        return actorUserId;
    }

    public String getActorName() {
        return actorName;
    }

    public String getReason() {
        return reason;
    }

    public String getSourceReference() {
        return sourceReference;
    }

    public String getIdempotencyKey() {
        return idempotencyKey;
    }

    public String getBodyHash() {
        return bodyHash;
    }

    public UUID getReversalOfTransactionId() {
        return reversalOfTransactionId;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
