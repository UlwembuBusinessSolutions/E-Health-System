package co.ehealth.platform.pharmacy.count;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

// One counting session. A DRAFT can be resumed any number of times; POSTED
// and CANCELLED are final. The reference (CNT-000012) is only assigned at
// posting so it identifies real adjustments, not abandoned drafts.
@Entity
@Table(name = "pharmacy_stock_counts")
public class PharmacyStockCount {

    @Id
    @GeneratedValue
    private UUID id;

    @Column(name = "facility_id", nullable = false)
    private UUID facilityId;

    @Column(name = "location_id", nullable = false)
    private UUID locationId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private CountScope scope;

    @Column(name = "scope_label", length = 200)
    private String scopeLabel;

    @Column(nullable = false)
    private boolean blind;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private CountStatus status;

    @Column(name = "started_by", nullable = false)
    private UUID startedBy;

    @Column(name = "started_by_name", nullable = false, length = 200)
    private String startedByName;

    @Column(name = "started_at", nullable = false)
    private Instant startedAt;

    @Column(name = "posted_by")
    private UUID postedBy;

    @Column(name = "posted_by_name", length = 200)
    private String postedByName;

    @Column(name = "posted_at")
    private Instant postedAt;

    @Column(length = 20)
    private String reference;

    protected PharmacyStockCount() {
    }

    public PharmacyStockCount(UUID facilityId, UUID locationId, CountScope scope, String scopeLabel, boolean blind,
                              UUID startedBy, String startedByName, Instant startedAt) {
        this.facilityId = facilityId;
        this.locationId = locationId;
        this.scope = scope;
        this.scopeLabel = scopeLabel;
        this.blind = blind;
        this.status = CountStatus.DRAFT;
        this.startedBy = startedBy;
        this.startedByName = startedByName;
        this.startedAt = startedAt;
    }

    public boolean isDraft() {
        return status == CountStatus.DRAFT;
    }

    public boolean isPosted() {
        return status == CountStatus.POSTED;
    }

    // Baselines stay hidden from the counter until the count is posted, so
    // the number they type is what they actually saw on the shelf.
    public boolean hidesBaselines() {
        return blind && isDraft();
    }

    public void cancel() {
        this.status = CountStatus.CANCELLED;
    }

    public void markPosted(String reference, UUID postedBy, String postedByName, Instant postedAt) {
        this.status = CountStatus.POSTED;
        this.reference = reference;
        this.postedBy = postedBy;
        this.postedByName = postedByName;
        this.postedAt = postedAt;
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

    public CountScope getScope() {
        return scope;
    }

    public String getScopeLabel() {
        return scopeLabel;
    }

    public boolean isBlind() {
        return blind;
    }

    public CountStatus getStatus() {
        return status;
    }

    public UUID getStartedBy() {
        return startedBy;
    }

    public String getStartedByName() {
        return startedByName;
    }

    public Instant getStartedAt() {
        return startedAt;
    }

    public UUID getPostedBy() {
        return postedBy;
    }

    public String getPostedByName() {
        return postedByName;
    }

    public Instant getPostedAt() {
        return postedAt;
    }

    public String getReference() {
        return reference;
    }
}
