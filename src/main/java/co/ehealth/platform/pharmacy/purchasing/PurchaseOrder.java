package co.ehealth.platform.pharmacy.purchasing;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

// What the pharmacy asked one supplier to send. Never edited after it is
// created and never moves stock; the goods arriving are a separate receipt.
@Entity
@Table(name = "pharmacy_purchase_orders")
public class PurchaseOrder {

    @Id
    @GeneratedValue
    private UUID id;

    @Column(name = "po_number", nullable = false, updatable = false, length = 20)
    private String poNumber;

    @Column(name = "facility_id", nullable = false, updatable = false)
    private UUID facilityId;

    @Column(name = "supplier_id", nullable = false)
    private UUID supplierId;

    @Column(name = "expected_delivery", updatable = false)
    private LocalDate expectedDelivery;

    @Column(name = "created_by", nullable = false, updatable = false)
    private UUID createdBy;

    @Column(name = "created_by_name", nullable = false, updatable = false, length = 200)
    private String createdByName;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    protected PurchaseOrder() {
    }

    public PurchaseOrder(String poNumber, UUID facilityId, UUID supplierId, LocalDate expectedDelivery,
                         UUID createdBy, String createdByName, Instant createdAt) {
        this.poNumber = poNumber;
        this.facilityId = facilityId;
        this.supplierId = supplierId;
        this.expectedDelivery = expectedDelivery;
        this.createdBy = createdBy;
        this.createdByName = createdByName;
        this.createdAt = createdAt;
    }

    public UUID getId() {
        return id;
    }

    public String getPoNumber() {
        return poNumber;
    }

    public UUID getFacilityId() {
        return facilityId;
    }

    public UUID getSupplierId() {
        return supplierId;
    }

    public LocalDate getExpectedDelivery() {
        return expectedDelivery;
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
}
