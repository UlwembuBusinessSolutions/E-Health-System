package co.ehealth.platform.pharmacy.count;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

// One lot in a count. baselineQuantity is the lot's system balance at the
// moment this line was counted — not when the count started — so stock
// that moves during a long count never shows up as a variance. A line that
// has not been counted has neither a baseline nor a counted quantity.
@Entity
@Table(name = "pharmacy_stock_count_lines")
public class PharmacyStockCountLine {

    @Id
    @GeneratedValue
    private UUID id;

    @Column(name = "count_id", nullable = false)
    private UUID countId;

    @Column(name = "product_id", nullable = false)
    private UUID productId;

    @Column(name = "batch_id")
    private UUID batchId;

    @Column(name = "found_in_count", nullable = false)
    private boolean foundInCount;

    @Column(name = "lot_number", nullable = false, length = 100)
    private String lotNumber;

    @Column(name = "expiry_date")
    private LocalDate expiryDate;

    @Column(name = "baseline_quantity")
    private Long baselineQuantity;

    @Column(name = "counted_quantity")
    private Long countedQuantity;

    @Column(length = 200)
    private String reason;

    @Column(name = "baseline_taken_at")
    private Instant baselineTakenAt;

    protected PharmacyStockCountLine() {
    }

    private PharmacyStockCountLine(UUID countId, UUID productId, UUID batchId, boolean foundInCount,
                                   String lotNumber, LocalDate expiryDate) {
        this.countId = countId;
        this.productId = productId;
        this.batchId = batchId;
        this.foundInCount = foundInCount;
        this.lotNumber = lotNumber;
        this.expiryDate = expiryDate;
    }

    public static PharmacyStockCountLine forLedgerLot(UUID countId, UUID productId, UUID batchId, String lotNumber,
                                                      LocalDate expiryDate) {
        return new PharmacyStockCountLine(countId, productId, batchId, false, lotNumber, expiryDate);
    }

    // A lot the ledger has never seen: nothing was on the books, so the
    // baseline is zero and the whole counted quantity is the variance.
    public static PharmacyStockCountLine forFoundLot(UUID countId, UUID productId, String lotNumber,
                                                     LocalDate expiryDate, long quantity, Instant foundAt) {
        PharmacyStockCountLine line = new PharmacyStockCountLine(countId, productId, null, true, lotNumber,
                expiryDate);
        line.recordCount(quantity, 0, foundAt);
        return line;
    }

    public void recordCount(long countedQuantity, long systemQuantityNow, Instant countedAt) {
        this.countedQuantity = countedQuantity;
        this.baselineQuantity = systemQuantityNow;
        this.baselineTakenAt = countedAt;
    }

    public void recordReason(String reason) {
        this.reason = reason;
    }

    public void assignBatch(UUID batchId) {
        this.batchId = batchId;
    }

    public boolean isCounted() {
        return countedQuantity != null;
    }

    public boolean hasVariance() {
        return isCounted() && variance() != 0;
    }

    public boolean hasReason() {
        return reason != null && !reason.isBlank();
    }

    public long variance() {
        return countedQuantity - baselineQuantity;
    }

    public UUID getId() {
        return id;
    }

    public UUID getCountId() {
        return countId;
    }

    public UUID getProductId() {
        return productId;
    }

    public UUID getBatchId() {
        return batchId;
    }

    public boolean isFoundInCount() {
        return foundInCount;
    }

    public String getLotNumber() {
        return lotNumber;
    }

    public LocalDate getExpiryDate() {
        return expiryDate;
    }

    public Long getBaselineQuantity() {
        return baselineQuantity;
    }

    public Long getCountedQuantity() {
        return countedQuantity;
    }

    public String getReason() {
        return reason;
    }

    public Instant getBaselineTakenAt() {
        return baselineTakenAt;
    }
}
