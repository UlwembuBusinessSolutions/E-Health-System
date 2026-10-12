package co.ehealth.platform.pharmacy.dispensing;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

// A pharmacist's confirmed "this prescribed name is that stock product",
// remembered so the same name is pre-selected next time. Only ever matched
// on the exact normalised name (DrugNames.normalise) — never fuzzily.
@Entity
@Table(name = "pharmacy_drug_mappings")
public class PharmacyDrugMapping {

    @Id
    @GeneratedValue
    private UUID id;

    @Column(name = "drug_name_key", nullable = false, unique = true, length = 200)
    private String drugNameKey;

    @Column(name = "product_id", nullable = false)
    private UUID productId;

    @Column(name = "confirmed_by", nullable = false)
    private UUID confirmedBy;

    @Column(name = "confirmed_at", nullable = false)
    private Instant confirmedAt;

    protected PharmacyDrugMapping() {
    }

    public PharmacyDrugMapping(String drugNameKey, UUID productId, UUID confirmedBy, Instant confirmedAt) {
        this.drugNameKey = drugNameKey;
        this.productId = productId;
        this.confirmedBy = confirmedBy;
        this.confirmedAt = confirmedAt;
    }

    // The latest confirmation wins: a pharmacist overriding a stale mapping
    // changes what is suggested from now on.
    public void remap(UUID productId, UUID confirmedBy, Instant confirmedAt) {
        this.productId = productId;
        this.confirmedBy = confirmedBy;
        this.confirmedAt = confirmedAt;
    }

    public String getDrugNameKey() {
        return drugNameKey;
    }

    public UUID getProductId() {
        return productId;
    }
}
