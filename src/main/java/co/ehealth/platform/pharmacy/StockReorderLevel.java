package co.ehealth.platform.pharmacy;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.util.UUID;

@Entity
@Table(name = "stock_reorder_levels")
public class StockReorderLevel {

    @Id
    @GeneratedValue
    private UUID id;

    @Column(name = "facility_id", nullable = false)
    private UUID facilityId;

    @Column(name = "drug_name", nullable = false, length = 200)
    private String drugName;

    @Column(name = "reorder_level", nullable = false)
    private int reorderLevel;

    protected StockReorderLevel() {
    }

    public StockReorderLevel(UUID facilityId, String drugName, int reorderLevel) {
        this.facilityId = facilityId;
        this.drugName = drugName;
        this.reorderLevel = reorderLevel;
    }

    public void setReorderLevel(int reorderLevel) {
        this.reorderLevel = reorderLevel;
    }

    public UUID getId() { return id; }
    public UUID getFacilityId() { return facilityId; }
    public String getDrugName() { return drugName; }
    public int getReorderLevel() { return reorderLevel; }
}
