package co.ehealth.platform.pharmacy.dispensing;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

// Units a patient brought back, recorded per lot so a lot can never be
// returned beyond what was dispensed from it. A single return spanning two
// lots is two rows sharing one ledger transaction.
@Entity
@Table(name = "prescription_returns")
public class PrescriptionReturn {

    @Id
    @GeneratedValue
    private UUID id;

    @Column(name = "prescription_item_id", nullable = false, updatable = false)
    private UUID prescriptionItemId;

    @Column(name = "batch_id", nullable = false, updatable = false)
    private UUID batchId;

    @Column(nullable = false, updatable = false)
    private int quantity;

    @Enumerated(EnumType.STRING)
    @Column(name = "condition", nullable = false, updatable = false, length = 20)
    private ReturnCondition condition;

    @Column(nullable = false, updatable = false, length = 500)
    private String reason;

    @Column(nullable = false, updatable = false)
    private boolean restocked;

    @Column(name = "stock_transaction_id", updatable = false)
    private UUID stockTransactionId;

    @Column(name = "recorded_by", nullable = false, updatable = false)
    private UUID recordedBy;

    @Column(name = "recorded_at", nullable = false, updatable = false)
    private Instant recordedAt;

    protected PrescriptionReturn() {
    }

    public PrescriptionReturn(UUID prescriptionItemId, UUID batchId, int quantity, ReturnCondition condition,
                               String reason, UUID stockTransactionId, UUID recordedBy, Instant recordedAt) {
        this.prescriptionItemId = prescriptionItemId;
        this.batchId = batchId;
        this.quantity = quantity;
        this.condition = condition;
        this.reason = reason;
        this.restocked = condition.isRestockable();
        this.stockTransactionId = stockTransactionId;
        this.recordedBy = recordedBy;
        this.recordedAt = recordedAt;
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
}
