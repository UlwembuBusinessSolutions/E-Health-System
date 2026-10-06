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

// The receiving record — plan section 8. status is always POSTED in
// Phase 1 (ReceiptStatus's own why-note on the deferred draft lifecycle);
// transactionId is set the moment PharmacyStockLedgerService posts the
// underlying movement, in the same database transaction that inserts this
// row, so a PharmacyReceipt never exists without its stock effect already
// applied.
@Entity
@Table(name = "pharmacy_receipts")
public class PharmacyReceipt {

    @Id
    @GeneratedValue
    private UUID id;

    @Column(name = "facility_id", nullable = false)
    private UUID facilityId;

    @Column(name = "location_id", nullable = false)
    private UUID locationId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private ReceiptStatus status;

    @Column(name = "source_reference", length = 200)
    private String sourceReference;

    @Column(name = "supplier_name", length = 200)
    private String supplierName;

    @Column(name = "created_by", nullable = false)
    private UUID createdBy;

    @Column(name = "created_by_name", nullable = false, length = 200)
    private String createdByName;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "transaction_id")
    private UUID transactionId;

    protected PharmacyReceipt() {
    }

    public PharmacyReceipt(UUID facilityId, UUID locationId, String sourceReference, String supplierName,
                            UUID createdBy, String createdByName, Instant createdAt, UUID transactionId) {
        this.facilityId = facilityId;
        this.locationId = locationId;
        this.status = ReceiptStatus.POSTED;
        this.sourceReference = sourceReference;
        this.supplierName = supplierName;
        this.createdBy = createdBy;
        this.createdByName = createdByName;
        this.createdAt = createdAt;
        this.transactionId = transactionId;
    }

    public UUID getId() {
        return id;
    }

    public UUID getFacilityId() {
        return facilityId;
    }

    public UUID getLocationId() {
        return locationId;
    }

    public ReceiptStatus getStatus() {
        return status;
    }

    public String getSourceReference() {
        return sourceReference;
    }

    public String getSupplierName() {
        return supplierName;
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

    public UUID getTransactionId() {
        return transactionId;
    }
}
