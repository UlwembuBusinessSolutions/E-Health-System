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

@Entity
@Table(name = "pharmacy_stock_orders")
public class PharmacyStockOrder {

    @Id
    @GeneratedValue
    private UUID id;

    @Column(name = "facility_id", nullable = false)
    private UUID facilityId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private PharmacyStockOrderStatus status;

    @Column(name = "created_by", nullable = false)
    private UUID createdBy;

    @Column(name = "created_by_name", nullable = false, length = 200)
    private String createdByName;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "authorised_by")
    private UUID authorisedBy;

    @Column(name = "authorised_by_name", length = 200)
    private String authorisedByName;

    @Column(name = "authorised_at")
    private Instant authorisedAt;

    @Column(name = "submitted_at")
    private Instant submittedAt;

    @Version
    @Column(nullable = false)
    private int version;

    protected PharmacyStockOrder() {
    }

    public PharmacyStockOrder(UUID facilityId, UUID createdBy, String createdByName, Instant createdAt) {
        this.facilityId = facilityId;
        this.createdBy = createdBy;
        this.createdByName = createdByName;
        this.createdAt = createdAt;
        this.status = PharmacyStockOrderStatus.DRAFT;
    }

    public void authorise(UUID userId, String userName, Instant at) {
        this.status = PharmacyStockOrderStatus.AUTHORISED;
        this.authorisedBy = userId;
        this.authorisedByName = userName;
        this.authorisedAt = at;
    }

    public void submit(Instant at) {
        this.status = PharmacyStockOrderStatus.SUBMITTED;
        this.submittedAt = at;
    }

    public UUID getId() { return id; }
    public UUID getFacilityId() { return facilityId; }
    public PharmacyStockOrderStatus getStatus() { return status; }
    public UUID getCreatedBy() { return createdBy; }
    public String getCreatedByName() { return createdByName; }
    public Instant getCreatedAt() { return createdAt; }
    public UUID getAuthorisedBy() { return authorisedBy; }
    public String getAuthorisedByName() { return authorisedByName; }
    public Instant getAuthorisedAt() { return authorisedAt; }
    public Instant getSubmittedAt() { return submittedAt; }
}