package co.ehealth.platform.pharmacy.stock;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

// One immutable signed line per affected stock account per transaction —
// plan section 7's "Required transaction data": signed base-unit entries,
// per-account balance before/after. seq is the server-assigned global
// ordering (BIGSERIAL — see V35's own why-note on why this, not
// createdAt, is what "server sequence order" means here).
@Entity
@Table(name = "pharmacy_stock_entries")
public class PharmacyStockEntry {

    @Id
    @GeneratedValue
    private UUID id;

    @Column(nullable = false, insertable = false, updatable = false)
    private long seq;

    @Column(name = "transaction_id", nullable = false)
    private UUID transactionId;

    @Column(name = "stock_account_id", nullable = false)
    private UUID stockAccountId;

    @Column(name = "quantity_delta", nullable = false)
    private long quantityDelta;

    @Column(name = "balance_before", nullable = false)
    private long balanceBefore;

    @Column(name = "balance_after", nullable = false)
    private long balanceAfter;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    protected PharmacyStockEntry() {
    }

    public PharmacyStockEntry(UUID transactionId, UUID stockAccountId, long quantityDelta, long balanceBefore,
                               long balanceAfter, Instant createdAt) {
        this.transactionId = transactionId;
        this.stockAccountId = stockAccountId;
        this.quantityDelta = quantityDelta;
        this.balanceBefore = balanceBefore;
        this.balanceAfter = balanceAfter;
        this.createdAt = createdAt;
    }

    public UUID getId() {
        return id;
    }

    public long getSeq() {
        return seq;
    }

    public UUID getTransactionId() {
        return transactionId;
    }

    public UUID getStockAccountId() {
        return stockAccountId;
    }

    public long getQuantityDelta() {
        return quantityDelta;
    }

    public long getBalanceBefore() {
        return balanceBefore;
    }

    public long getBalanceAfter() {
        return balanceAfter;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
