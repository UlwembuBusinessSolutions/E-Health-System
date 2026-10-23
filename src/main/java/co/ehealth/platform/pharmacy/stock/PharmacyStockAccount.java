package co.ehealth.platform.pharmacy.stock;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.util.UUID;

// One balance per (product, batch, location, bucket) — plan section 14.
// quantity is the only mutable column, and only ever changed by
// PharmacyStockLedgerService inside a locked, atomic posting (fetched with
// a pessimistic write lock — see the repository's own why-note); no
// controller or other service may call setQuantity() directly.
@Entity
@Table(name = "pharmacy_stock_accounts")
public class PharmacyStockAccount {

    @Id
    @GeneratedValue
    private UUID id;

    @Column(name = "product_id", nullable = false)
    private UUID productId;

    @Column(name = "batch_id", nullable = false)
    private UUID batchId;

    @Column(name = "location_id", nullable = false)
    private UUID locationId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private StockBucket bucket;

    @Column(nullable = false)
    private long quantity;

    protected PharmacyStockAccount() {
    }

    public PharmacyStockAccount(UUID productId, UUID batchId, UUID locationId, StockBucket bucket) {
        this.productId = productId;
        this.batchId = batchId;
        this.locationId = locationId;
        this.bucket = bucket;
        this.quantity = 0;
    }

    // Only PharmacyStockLedgerService.postEntries() calls this, inside a
    // transaction that already holds this row's pessimistic write lock and
    // has already rejected the posting if it would go negative — this
    // method itself doesn't re-check that (its caller already has, with
    // the actual entry it's about to write), it just applies the delta.
    public long applyDelta(long delta) {
        long newQuantity = quantity + delta;
        this.quantity = newQuantity;
        return newQuantity;
    }

    public UUID getId() {
        return id;
    }

    public UUID getProductId() {
        return productId;
    }

    public UUID getBatchId() {
        return batchId;
    }

    public UUID getLocationId() {
        return locationId;
    }

    public StockBucket getBucket() {
        return bucket;
    }

    public long getQuantity() {
        return quantity;
    }
}
