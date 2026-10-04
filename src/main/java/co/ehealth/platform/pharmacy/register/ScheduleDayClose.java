package co.ehealth.platform.pharmacy.register;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

// The signed end-of-day reconciliation for one product at one facility.
// Written once and never changed; its existence is what locks the day.
@Entity
@Table(name = "pharmacy_schedule_day_closes")
public class ScheduleDayClose {

    @Id
    @GeneratedValue
    private UUID id;

    @Column(name = "facility_id", nullable = false, updatable = false)
    private UUID facilityId;

    @Column(name = "product_id", nullable = false, updatable = false)
    private UUID productId;

    @Column(name = "business_date", nullable = false, updatable = false)
    private LocalDate businessDate;

    @Column(nullable = false, updatable = false)
    private long opening;

    @Column(nullable = false, updatable = false)
    private long received;

    @Column(nullable = false, updatable = false)
    private long dispensed;

    @Column(nullable = false, updatable = false)
    private long destroyed;

    @Column(nullable = false, updatable = false)
    private long lost;

    @Column(nullable = false, updatable = false)
    private long returned;

    @Column(nullable = false, updatable = false)
    private long expected;

    @Column(nullable = false, updatable = false)
    private long counted;

    @Column(nullable = false, updatable = false)
    private long variance;

    @Column(name = "variance_reason", updatable = false, length = 500)
    private String varianceReason;

    @Column(name = "closed_by", nullable = false, updatable = false)
    private UUID closedBy;

    @Column(name = "closed_by_name", nullable = false, updatable = false, length = 200)
    private String closedByName;

    @Column(name = "closed_at", nullable = false, updatable = false)
    private Instant closedAt;

    protected ScheduleDayClose() {
    }

    ScheduleDayClose(UUID facilityId, UUID productId, LocalDate businessDate, DayFigures figures, long counted,
                     String varianceReason, RegisterStaff closedBy, Instant closedAt) {
        this.facilityId = facilityId;
        this.productId = productId;
        this.businessDate = businessDate;
        this.opening = figures.opening();
        this.received = figures.received();
        this.dispensed = figures.dispensed();
        this.destroyed = figures.destroyed();
        this.lost = figures.lost();
        this.returned = figures.returned();
        this.expected = figures.expected();
        this.counted = counted;
        this.variance = counted - figures.expected();
        this.varianceReason = varianceReason;
        this.closedBy = closedBy.id();
        this.closedByName = closedBy.name();
        this.closedAt = closedAt;
    }

    DayFigures figures() {
        return new DayFigures(opening, received, dispensed, destroyed, lost, returned);
    }

    public UUID getFacilityId() {
        return facilityId;
    }

    public UUID getProductId() {
        return productId;
    }

    public LocalDate getBusinessDate() {
        return businessDate;
    }

    public long getExpected() {
        return expected;
    }

    public long getCounted() {
        return counted;
    }

    public long getVariance() {
        return variance;
    }

    public String getVarianceReason() {
        return varianceReason;
    }

    public String getClosedByName() {
        return closedByName;
    }

    public Instant getClosedAt() {
        return closedAt;
    }
}
