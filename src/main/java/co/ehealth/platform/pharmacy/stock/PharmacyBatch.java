package co.ehealth.platform.pharmacy.stock;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

// A tracked lot — plan section 6. Every product gets at least one batch
// row, even an untracked one (lotNumber "N/A", expiryDate null) — see
// V35's own why-note on why pharmacy_stock_accounts always references a
// non-null batch id rather than special-casing nullability. Conflicting
// expiry for the same (product, manufacturer, lotNumber) is rejected at
// receipt time (PharmacyStockLedgerService) rather than silently merged or
// forked into a hidden duplicate lot (plan's own rule).
@Entity
@Table(name = "pharmacy_batches")
public class PharmacyBatch {

    @Id
    @GeneratedValue
    private UUID id;

    @Column(name = "product_id", nullable = false)
    private UUID productId;

    @Column(length = 200)
    private String manufacturer;

    @Column(name = "lot_number", nullable = false, length = 100)
    private String lotNumber;

    @Column(name = "expiry_date")
    private LocalDate expiryDate;

    @Enumerated(EnumType.STRING)
    @Column(name = "expiry_precision", length = 10)
    private ExpiryPrecision expiryPrecision;

    @Column(name = "printed_expiry", length = 50)
    private String printedExpiry;

    @Column(name = "created_by", nullable = false)
    private UUID createdBy;

    @Column(name = "created_by_name", nullable = false, length = 200)
    private String createdByName;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    protected PharmacyBatch() {
    }

    public PharmacyBatch(UUID productId, String manufacturer, String lotNumber, LocalDate expiryDate,
                          ExpiryPrecision expiryPrecision, String printedExpiry, UUID createdBy,
                          String createdByName, Instant createdAt) {
        this.productId = productId;
        this.manufacturer = manufacturer;
        this.lotNumber = lotNumber;
        this.expiryDate = expiryDate;
        this.expiryPrecision = expiryPrecision;
        this.printedExpiry = printedExpiry;
        this.createdBy = createdBy;
        this.createdByName = createdByName;
        this.createdAt = createdAt;
    }

    public UUID getId() {
        return id;
    }

    public UUID getProductId() {
        return productId;
    }

    public String getManufacturer() {
        return manufacturer;
    }

    public String getLotNumber() {
        return lotNumber;
    }

    public LocalDate getExpiryDate() {
        return expiryDate;
    }

    public ExpiryPrecision getExpiryPrecision() {
        return expiryPrecision;
    }

    public String getPrintedExpiry() {
        return printedExpiry;
    }

    public UUID getCreatedBy() {
        return createdBy;
    }

    public String getCreatedByName() {
        return createdByName;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    // Dispensing eligibility, not physical removal — plan section 6:
    // "Expiry changes eligibility, not physical quantity." Proposed rule:
    // usable through the recorded date, blocked from the next day's start
    // in the facility's own timezone.
    public boolean isExpiredAsOf(LocalDate facilityLocalDate) {
        return expiryDate != null && expiryDate.isBefore(facilityLocalDate);
    }
}
