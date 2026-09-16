package co.ehealth.platform.pharmacy;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

/** The durable collaboration record between pharmacy and the prescriber. */
@Entity
@Table(name = "prescription_queries")
public class PrescriptionQuery {
    @Id @GeneratedValue private UUID id;
    @Column(name = "prescription_id", nullable = false) private UUID prescriptionId;
    @Column(name = "facility_id", nullable = false) private UUID facilityId;
    @Column(name = "raised_by_user_id", nullable = false) private UUID raisedByUserId;
    @Column(name = "prescriber_id", nullable = false) private UUID prescriberId;
    @Column(nullable = false, length = 2000) private String reason;
    @Column(name = "guideline_warning", length = 4000) private String guidelineWarning;
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 20) private PrescriptionQueryStatus status;
    @Column(name = "prescriber_response", length = 2000) private String prescriberResponse;
    @Column(name = "raised_at", nullable = false) private Instant raisedAt;
    @Column(name = "responded_at") private Instant respondedAt;
    protected PrescriptionQuery() { }
    public PrescriptionQuery(UUID prescriptionId, UUID facilityId, UUID raisedByUserId, UUID prescriberId,
                             String reason, String guidelineWarning, Instant raisedAt) {
        this.prescriptionId = prescriptionId; this.facilityId = facilityId; this.raisedByUserId = raisedByUserId;
        this.prescriberId = prescriberId; this.reason = reason; this.guidelineWarning = guidelineWarning;
        this.raisedAt = raisedAt; this.status = PrescriptionQueryStatus.OPEN;
    }
    public void respond(String response, Instant at) { this.prescriberResponse = response; this.respondedAt = at; this.status = PrescriptionQueryStatus.RESPONDED; }
    public UUID getId() { return id; } public UUID getPrescriptionId() { return prescriptionId; }
    public UUID getFacilityId() { return facilityId; } public UUID getRaisedByUserId() { return raisedByUserId; }
    public UUID getPrescriberId() { return prescriberId; } public String getReason() { return reason; }
    public String getGuidelineWarning() { return guidelineWarning; } public PrescriptionQueryStatus getStatus() { return status; }
    public String getPrescriberResponse() { return prescriberResponse; } public Instant getRaisedAt() { return raisedAt; }
    public Instant getRespondedAt() { return respondedAt; }
}
