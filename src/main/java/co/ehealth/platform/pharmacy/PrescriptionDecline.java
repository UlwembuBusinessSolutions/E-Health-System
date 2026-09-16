package co.ehealth.platform.pharmacy;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "prescription_declines")
public class PrescriptionDecline {
    @Id @GeneratedValue private UUID id;
    @Column(name = "prescription_id", nullable = false, unique = true) private UUID prescriptionId;
    @Column(name = "facility_id", nullable = false) private UUID facilityId;
    @Column(name = "pharmacist_id", nullable = false) private UUID pharmacistId;
    @Column(name = "prescriber_id", nullable = false) private UUID prescriberId;
    @Enumerated(EnumType.STRING) @Column(name = "reason_code", nullable = false) private DeclineReasonCode reasonCode;
    @Column(name = "reason_detail") private String reasonDetail;
    @Column(name = "declined_at", nullable = false) private Instant declinedAt;
    protected PrescriptionDecline() { }
    public PrescriptionDecline(Prescription p, UUID pharmacistId, DeclineReasonCode reasonCode, String reasonDetail, Instant declinedAt) {
        this.prescriptionId = p.getId(); this.facilityId = p.getFacilityId(); this.prescriberId = p.getPrescriberId();
        this.pharmacistId = pharmacistId; this.reasonCode = reasonCode; this.reasonDetail = reasonDetail; this.declinedAt = declinedAt;
    }
    public UUID getId() { return id; }
    public UUID getPrescriptionId() { return prescriptionId; }
    public UUID getFacilityId() { return facilityId; }
    public UUID getPharmacistId() { return pharmacistId; }
    public UUID getPrescriberId() { return prescriberId; }
    public DeclineReasonCode getReasonCode() { return reasonCode; }
    public String getReasonDetail() { return reasonDetail; }
    public Instant getDeclinedAt() { return declinedAt; }
}
