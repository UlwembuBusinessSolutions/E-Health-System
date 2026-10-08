package co.ehealth.platform.pharmacy.dispensing;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

// Links a dispensed quantity to the lot it came from and to the ledger
// transaction that deducted it — the trace a recall or an audit follows from
// a patient back to a specific lot. Never edited after insert.
@Entity
@Table(name = "pharmacy_dispense_allocations")
public class DispenseAllocation {

    @Id
    @GeneratedValue
    private UUID id;

    @Column(name = "prescription_item_id", nullable = false, updatable = false)
    private UUID prescriptionItemId;

    @Column(name = "batch_id", nullable = false, updatable = false)
    private UUID batchId;

    @Column(nullable = false, updatable = false)
    private int quantity;

    @Column(name = "stock_transaction_id", nullable = false, updatable = false)
    private UUID stockTransactionId;

    @Column(name = "dispensed_by", nullable = false, updatable = false)
    private UUID dispensedBy;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    protected DispenseAllocation() {
    }

    public DispenseAllocation(UUID prescriptionItemId, UUID batchId, int quantity, UUID stockTransactionId,
                               UUID dispensedBy, Instant createdAt) {
        this.prescriptionItemId = prescriptionItemId;
        this.batchId = batchId;
        this.quantity = quantity;
        this.stockTransactionId = stockTransactionId;
        this.dispensedBy = dispensedBy;
        this.createdAt = createdAt;
    }

    public UUID getId() {
        return id;
    }

    public UUID getPrescriptionItemId() {
        return prescriptionItemId;
    }

    public UUID getBatchId() {
        return batchId;
    }

    public int getQuantity() {
        return quantity;
    }

    public UUID getStockTransactionId() {
        return stockTransactionId;
    }

    public UUID getDispensedBy() {
        return dispensedBy;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
