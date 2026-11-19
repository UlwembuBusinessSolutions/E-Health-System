package co.ehealth.platform.art;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "art_initiation_clinician_details",
        uniqueConstraints = @UniqueConstraint(name = "uq_art_initiation_clinician_details_visit_id", columnNames = "visit_id"))
public class ArtInitiationClinicianDetails {
    @Id @GeneratedValue private UUID id;
    @Column(name = "visit_id", nullable = false) private UUID visitId;
    @Column(name = "signature_data_url", columnDefinition = "TEXT") private String signatureDataUrl;
    @Column(name = "clinician_name", length = 200) private String clinicianName;
    @Column(name = "clinician_qualifications", columnDefinition = "TEXT") private String clinicianQualifications;
    @Column(name = "sanc_number", length = 30) private String sancNumber;
    @Column(name = "hpcsa_number", length = 30) private String hpcsaNumber;
    @Column(name = "created_by_user_id", nullable = false) private UUID createdByUserId;
    @Column(name = "updated_by_user_id", nullable = false) private UUID updatedByUserId;
    @Column(name = "created_at", nullable = false) private Instant createdAt;
    @Column(name = "updated_at", nullable = false) private Instant updatedAt;

    protected ArtInitiationClinicianDetails() {}

    public ArtInitiationClinicianDetails(UUID visitId, UUID userId, Instant now) {
        this.visitId = visitId;
        this.createdByUserId = userId;
        this.createdAt = now;
        this.updatedByUserId = userId;
        this.updatedAt = now;
    }

    public void update(ArtInitiationClinicianDetailsController.SaveRequest request, UUID userId, Instant now) {
        this.signatureDataUrl = request.signatureDataUrl();
        this.clinicianName = normalize(request.clinicianName());
        this.clinicianQualifications = normalize(request.clinicianQualifications());
        this.sancNumber = normalize(request.sancNumber());
        this.hpcsaNumber = normalize(request.hpcsaNumber());
        this.updatedByUserId = userId;
        this.updatedAt = now;
    }

    private static String normalize(String value) { return value == null || value.isBlank() ? null : value.trim(); }
    public UUID getId() { return id; }
    public UUID getVisitId() { return visitId; }
    public String getSignatureDataUrl() { return signatureDataUrl; }
    public String getClinicianName() { return clinicianName; }
    public String getClinicianQualifications() { return clinicianQualifications; }
    public String getSancNumber() { return sancNumber; }
    public String getHpcsaNumber() { return hpcsaNumber; }
    public UUID getUpdatedByUserId() { return updatedByUserId; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
}
