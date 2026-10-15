package co.ehealth.platform.pharmacy.stock;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

// A bin/location within a facility. Phase 1 auto-creates exactly one
// ("Main", code "MAIN") per facility on first use (PharmacyStockLocationService)
// — nobody manages these directly yet; the table exists now so multi-
// location tracking later is additive.
@Entity
@Table(name = "pharmacy_stock_locations")
public class PharmacyStockLocation {

    @Id
    @GeneratedValue
    private UUID id;

    @Column(name = "facility_id", nullable = false)
    private UUID facilityId;

    @Column(nullable = false, length = 20)
    private String code;

    @Column(nullable = false, length = 100)
    private String name;

    @Column(nullable = false)
    private boolean active;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    protected PharmacyStockLocation() {
    }

    public PharmacyStockLocation(UUID facilityId, String code, String name, Instant createdAt) {
        this.facilityId = facilityId;
        this.code = code;
        this.name = name;
        this.active = true;
        this.createdAt = createdAt;
    }

    public UUID getId() {
        return id;
    }

    public UUID getFacilityId() {
        return facilityId;
    }

    public String getCode() {
        return code;
    }

    public String getName() {
        return name;
    }

    public boolean isActive() {
        return active;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
