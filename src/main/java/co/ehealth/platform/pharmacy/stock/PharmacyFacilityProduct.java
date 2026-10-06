package co.ehealth.platform.pharmacy.stock;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

// A facility's assortment entry for one product — plan section 4: a
// product never stocked at a facility must not surface as out-of-stock
// there. Creating this row still doesn't move quantity; only a posted
// receipt against this (product, facility) pair does.
@Entity
@Table(name = "pharmacy_facility_products")
public class PharmacyFacilityProduct {

    @Id
    @GeneratedValue
    private UUID id;

    @Column(name = "product_id", nullable = false)
    private UUID productId;

    @Column(name = "facility_id", nullable = false)
    private UUID facilityId;

    @Column(name = "reorder_threshold")
    private Integer reorderThreshold;

    @Column(name = "target_quantity")
    private Integer targetQuantity;

    @Column(nullable = false)
    private boolean active;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    protected PharmacyFacilityProduct() {
    }

    public PharmacyFacilityProduct(UUID productId, UUID facilityId, Integer reorderThreshold,
                                    Integer targetQuantity, Instant createdAt) {
        this.productId = productId;
        this.facilityId = facilityId;
        this.reorderThreshold = reorderThreshold;
        this.targetQuantity = targetQuantity;
        this.active = true;
        this.createdAt = createdAt;
    }

    public void updateLevels(Integer reorderThreshold, Integer targetQuantity) {
        this.reorderThreshold = reorderThreshold;
        this.targetQuantity = targetQuantity;
    }

    public UUID getId() {
        return id;
    }

    public UUID getProductId() {
        return productId;
    }

    public UUID getFacilityId() {
        return facilityId;
    }

    public Integer getReorderThreshold() {
        return reorderThreshold;
    }

    public Integer getTargetQuantity() {
        return targetQuantity;
    }

    public boolean isActive() {
        return active;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
