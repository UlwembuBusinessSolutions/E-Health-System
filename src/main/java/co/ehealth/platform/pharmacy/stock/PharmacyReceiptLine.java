package co.ehealth.platform.pharmacy.stock;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.LocalDate;
import java.util.UUID;

// One product/batch line on a receipt — plan section 8. Preserves the
// entered packs/pack size alongside the resulting baseQuantity (plan
// section 4: "Receipt lines preserve entered packs, conversion and
// resulting base quantity. New packaging configuration must not
// reinterpret old transactions.") — baseQuantity, not packs, is what
// PharmacyStockLedgerService actually posts.
@Entity
@Table(name = "pharmacy_receipt_lines")
public class PharmacyReceiptLine {

    @Id
    @GeneratedValue
    private UUID id;

    @Column(name = "receipt_id", nullable = false)
    private UUID receiptId;

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

    @Column
    private Integer packs;

    @Column(name = "pack_size_used")
    private Integer packSizeUsed;

    @Column(name = "base_quantity", nullable = false)
    private int baseQuantity;

    @Column(name = "batch_id")
    private UUID batchId;

    protected PharmacyReceiptLine() {
    }

    public PharmacyReceiptLine(UUID receiptId, UUID productId, String manufacturer, String lotNumber,
                                LocalDate expiryDate, ExpiryPrecision expiryPrecision, Integer packs,
                                Integer packSizeUsed, int baseQuantity, UUID batchId) {
        this.receiptId = receiptId;
        this.productId = productId;
        this.manufacturer = manufacturer;
        this.lotNumber = lotNumber;
        this.expiryDate = expiryDate;
        this.expiryPrecision = expiryPrecision;
        this.packs = packs;
        this.packSizeUsed = packSizeUsed;
        this.baseQuantity = baseQuantity;
        this.batchId = batchId;
    }

    public UUID getId() {
        return id;
    }

    public UUID getReceiptId() {
        return receiptId;
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

    public Integer getPacks() {
        return packs;
    }

    public Integer getPackSizeUsed() {
        return packSizeUsed;
    }

    public int getBaseQuantity() {
        return baseQuantity;
    }

    public UUID getBatchId() {
        return batchId;
    }
}
