package co.ehealth.platform.pharmacy;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "stock_movements")
public class StockMovement {

    @Id
    @GeneratedValue
    private UUID id;

    @Column(name = "facility_id", nullable = false)
    private UUID facilityId;

    @Column(name = "drug_name", nullable = false, length = 200)
    private String drugName;

    @Column(name = "batch_id")
    private UUID batchId;

    @Enumerated(EnumType.STRING)
    @Column(name = "movement_type", nullable = false, length = 20)
    private StockMovementType movementType;

    @Column(name = "quantity_delta", nullable = false)
    private int quantityDelta;

    @Column(name = "quantity_before", nullable = false)
    private int quantityBefore;

    @Column(name = "quantity_after", nullable = false)
    private int quantityAfter;

    @Column(name = "reference_id", length = 100)
    private String referenceId;

    @Column(name = "performed_by_user_id")
    private UUID performedByUserId;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    protected StockMovement() {
    }

    public StockMovement(UUID facilityId, String drugName, UUID batchId, StockMovementType movementType,
                         int quantityDelta, int quantityBefore, int quantityAfter, String referenceId,
                         UUID performedByUserId, Instant createdAt) {
        this.facilityId = facilityId;
        this.drugName = drugName;
        this.batchId = batchId;
        this.movementType = movementType;
        this.quantityDelta = quantityDelta;
        this.quantityBefore = quantityBefore;
        this.quantityAfter = quantityAfter;
        this.referenceId = referenceId;
        this.performedByUserId = performedByUserId;
        this.createdAt = createdAt;
    }

    public UUID getId() { return id; }
    public UUID getFacilityId() { return facilityId; }
    public String getDrugName() { return drugName; }
    public UUID getBatchId() { return batchId; }
    public StockMovementType getMovementType() { return movementType; }
    public int getQuantityDelta() { return quantityDelta; }
    public int getQuantityBefore() { return quantityBefore; }
    public int getQuantityAfter() { return quantityAfter; }
    public String getReferenceId() { return referenceId; }
    public UUID getPerformedByUserId() { return performedByUserId; }
    public Instant getCreatedAt() { return createdAt; }
}
