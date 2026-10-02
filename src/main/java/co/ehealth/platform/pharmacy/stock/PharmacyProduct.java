package co.ehealth.platform.pharmacy.stock;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;

import java.time.Instant;
import java.util.UUID;

// The organization-wide catalog entry — plan section 4. Creating a product
// never touches quantity (rule 1 of the plan's non-negotiable stock rules):
// a fresh product always starts with zero stock accounts until a receipt
// is posted against it. baseUnit/batchTracked/expiryTracked are frozen
// after the product's first posted movement — PharmacyProductService.update()
// enforces that, not this entity — a material change to any of them makes
// a new product rather than reinterpreting quantities already posted.
@Entity
@Table(name = "pharmacy_products")
public class PharmacyProduct {

    @Id
    @GeneratedValue
    private UUID id;

    @Column(nullable = false, length = 50)
    private String code;

    @Column(name = "display_name", nullable = false, length = 200)
    private String displayName;

    @Column(name = "generic_name", length = 200)
    private String genericName;

    @Column(length = 100)
    private String strength;

    @Column(name = "dosage_form", length = 100)
    private String dosageForm;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private StockCategory category;

    @Enumerated(EnumType.STRING)
    @Column(name = "base_unit", nullable = false, length = 20)
    private StockBaseUnit baseUnit;

    @Column(name = "pack_size")
    private Integer packSize;

    @Column(length = 64)
    private String barcode;

    @Column(length = 200)
    private String manufacturer;

    @Column(name = "batch_tracked", nullable = false)
    private boolean batchTracked;

    @Column(name = "expiry_tracked", nullable = false)
    private boolean expiryTracked;

    @Column(name = "storage_instructions", length = 500)
    private String storageInstructions;

    @Column(nullable = false)
    private boolean active;

    @Column(name = "created_by", nullable = false)
    private UUID createdBy;

    @Column(name = "created_by_name", nullable = false, length = 200)
    private String createdByName;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_by")
    private UUID updatedBy;

    @Column(name = "updated_by_name", length = 200)
    private String updatedByName;

    @Column(name = "updated_at")
    private Instant updatedAt;

    @Version
    @Column(nullable = false)
    private int version;

    protected PharmacyProduct() {
    }

    public PharmacyProduct(String code, String displayName, String genericName, String strength, String dosageForm,
                            StockCategory category, StockBaseUnit baseUnit, Integer packSize, String barcode,
                            String manufacturer, boolean batchTracked, boolean expiryTracked,
                            String storageInstructions, UUID createdBy, String createdByName, Instant createdAt) {
        this.code = code;
        this.displayName = displayName;
        this.genericName = genericName;
        this.strength = strength;
        this.dosageForm = dosageForm;
        this.category = category;
        this.baseUnit = baseUnit;
        this.packSize = packSize;
        this.barcode = barcode;
        this.manufacturer = manufacturer;
        this.batchTracked = batchTracked;
        this.expiryTracked = expiryTracked;
        this.storageInstructions = storageInstructions;
        this.active = true;
        this.createdBy = createdBy;
        this.createdByName = createdByName;
        this.createdAt = createdAt;
    }

    // Metadata-only — never baseUnit/batchTracked/expiryTracked (frozen
    // once posted, PharmacyProductService's own why-note) and never
    // quantity (there is none on this entity at all).
    public void updateDetails(String displayName, String genericName, String strength, String dosageForm,
                               Integer packSize, String barcode, String manufacturer, String storageInstructions,
                               UUID updatedBy, String updatedByName, Instant updatedAt) {
        this.displayName = displayName;
        this.genericName = genericName;
        this.strength = strength;
        this.dosageForm = dosageForm;
        this.packSize = packSize;
        this.barcode = barcode;
        this.manufacturer = manufacturer;
        this.storageInstructions = storageInstructions;
        this.updatedBy = updatedBy;
        this.updatedByName = updatedByName;
        this.updatedAt = updatedAt;
    }

    public void archive(UUID updatedBy, String updatedByName, Instant updatedAt) {
        this.active = false;
        this.updatedBy = updatedBy;
        this.updatedByName = updatedByName;
        this.updatedAt = updatedAt;
    }

    public void reactivate(UUID updatedBy, String updatedByName, Instant updatedAt) {
        this.active = true;
        this.updatedBy = updatedBy;
        this.updatedByName = updatedByName;
        this.updatedAt = updatedAt;
    }

    public UUID getId() {
        return id;
    }

    public String getCode() {
        return code;
    }

    public String getDisplayName() {
        return displayName;
    }

    public String getGenericName() {
        return genericName;
    }

    public String getStrength() {
        return strength;
    }

    public String getDosageForm() {
        return dosageForm;
    }

    public StockCategory getCategory() {
        return category;
    }

    public StockBaseUnit getBaseUnit() {
        return baseUnit;
    }

    public Integer getPackSize() {
        return packSize;
    }

    public String getBarcode() {
        return barcode;
    }

    public String getManufacturer() {
        return manufacturer;
    }

    public boolean isBatchTracked() {
        return batchTracked;
    }

    public boolean isExpiryTracked() {
        return expiryTracked;
    }

    public String getStorageInstructions() {
        return storageInstructions;
    }

    public boolean isActive() {
        return active;
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

    public UUID getUpdatedBy() {
        return updatedBy;
    }

    public String getUpdatedByName() {
        return updatedByName;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public int getVersion() {
        return version;
    }
}
