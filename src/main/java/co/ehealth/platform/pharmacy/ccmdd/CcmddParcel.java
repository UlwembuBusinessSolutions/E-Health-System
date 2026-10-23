package co.ehealth.platform.pharmacy.ccmdd;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name="ccmdd_parcels")
public class CcmddParcel {
    @Id @GeneratedValue private UUID id;
    @Column(name="prescription_id",nullable=false) private UUID prescriptionId;
    @Column(name="facility_id",nullable=false) private UUID facilityId;
    @Column(name="patient_id",nullable=false) private UUID patientId;
    @ManyToOne(fetch=FetchType.LAZY) @JoinColumn(name="pickup_point_id",nullable=false) private CcmddPickupPoint pickupPoint;
    @Column(name="tracking_reference",nullable=false) private String trackingReference;
    @Column(nullable=false) private String status;
    @Column(name="dispatched_at",nullable=false) private Instant dispatchedAt;
    @Column(name="ready_at") private Instant readyAt;
    @Column(name="collected_at") private Instant collectedAt;
    @Column(name="returned_at") private Instant returnedAt;
    @Column(name="trace_due_at",nullable=false) private Instant traceDueAt;
    @Column(name="tracing_days",nullable=false) private int tracingDays;
    @Column(name="notified_at") private Instant notifiedAt;
    @Column(name="notification_status",nullable=false) private String notificationStatus;
    @Column(name="notification_error") private String notificationError;
    @Column(name="trace_attempts",nullable=false) private int traceAttempts;
    @Column(name="last_traced_at") private Instant lastTracedAt;
    @Column(name="trace_note") private String traceNote;
    @Column(name="created_by",nullable=false) private UUID createdBy;
    @Column(name="updated_at",nullable=false) private Instant updatedAt;

    protected CcmddParcel() {}
    public CcmddParcel(UUID prescriptionId, UUID facilityId, UUID patientId, CcmddPickupPoint point,
                       int tracingDays, UUID createdBy, Instant now) {
        this.prescriptionId = prescriptionId; this.facilityId = facilityId; this.patientId = patientId;
        this.pickupPoint = point; this.tracingDays = tracingDays; this.createdBy = createdBy;
        this.trackingReference = "CCMDD-" + UUID.randomUUID().toString().substring(0, 12).toUpperCase();
        this.status = "DISPATCHED"; this.notificationStatus = "NOT_CONFIGURED";
        this.dispatchedAt = now; this.traceDueAt = now.plusSeconds(tracingDays * 86400L); this.updatedAt = now;
    }
    public void ready(Instant now) { status = "READY"; readyAt = now; updatedAt = now; }
    public void collected(Instant now) { status = "COLLECTED"; collectedAt = now; updatedAt = now; }
    public void returned(Instant now) { status = "RETURNED"; returnedAt = now; updatedAt = now; }
    public void traced(String note, Instant now) { traceAttempts++; lastTracedAt = now; traceNote = note; updatedAt = now; }
    public void notificationQueued(Instant now) { notificationStatus = "QUEUED"; notifiedAt = now; notificationError = null; }
    public void notificationMissing() { notificationStatus = "NOT_CONFIGURED"; notifiedAt = null; notificationError = null; }
    public void notificationFailed(String reason) { notificationStatus = "FAILED"; notificationError = reason.substring(0, Math.min(500, reason.length())); }
    public UUID getId() { return id; }
    public UUID getPrescriptionId() { return prescriptionId; }
    public UUID getFacilityId() { return facilityId; }
    public UUID getPatientId() { return patientId; }
    public CcmddPickupPoint getPickupPoint() { return pickupPoint; }
    public String getTrackingReference() { return trackingReference; }
    public String getStatus() { return status; }
    public Instant getDispatchedAt() { return dispatchedAt; }
    public Instant getReadyAt() { return readyAt; }
    public Instant getCollectedAt() { return collectedAt; }
    public Instant getReturnedAt() { return returnedAt; }
    public Instant getTraceDueAt() { return traceDueAt; }
    public int getTracingDays() { return tracingDays; }
    public Instant getNotifiedAt() { return notifiedAt; }
    public String getNotificationStatus() { return notificationStatus; }
    public String getNotificationError() { return notificationError; }
    public int getTraceAttempts() { return traceAttempts; }
    public Instant getLastTracedAt() { return lastTracedAt; }
    public String getTraceNote() { return traceNote; }
}
