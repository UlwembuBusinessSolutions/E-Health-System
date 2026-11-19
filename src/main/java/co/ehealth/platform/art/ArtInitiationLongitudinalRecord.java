package co.ehealth.platform.art;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "art_initiation_longitudinal_records")
public class ArtInitiationLongitudinalRecord {
    @Id @GeneratedValue private UUID id;
    @Column(name = "visit_id", nullable = false) private UUID visitId;
    @Column(name = "record_date", nullable = false) private LocalDate recordDate;
    @Column(name = "duration_on_art_months") private Integer durationOnArtMonths;
    @Enumerated(EnumType.STRING)
    @Column(name = "stage", nullable = false, length = 20) private ArtStage stage;
    @Column(name = "patient_weight_kg", precision = 6, scale = 2) private BigDecimal patientWeightKg;
    @Column(name = "viral_load", length = 200) private String viralLoad;
    @Column(name = "cd4_count", length = 200) private String cd4Count;
    @Column(name = "stage_description", columnDefinition = "TEXT") private String stageDescription;
    @Column(name = "signed_by_user_id", nullable = false) private UUID signedByUserId;
    @Column(name = "signed_at", nullable = false) private Instant signedAt;

    protected ArtInitiationLongitudinalRecord() {}

    public ArtInitiationLongitudinalRecord(UUID visitId, LocalDate recordDate, Integer durationOnArtMonths,
            ArtStage stage, BigDecimal patientWeightKg, String viralLoad, String cd4Count,
            String stageDescription, UUID signedByUserId, Instant signedAt) {
        this.visitId = visitId;
        this.recordDate = recordDate;
        this.durationOnArtMonths = durationOnArtMonths;
        this.stage = stage;
        this.patientWeightKg = patientWeightKg;
        this.viralLoad = viralLoad;
        this.cd4Count = cd4Count;
        this.stageDescription = stageDescription;
        this.signedByUserId = signedByUserId;
        this.signedAt = signedAt;
    }

    public UUID getId() { return id; }
    public UUID getVisitId() { return visitId; }
    public LocalDate getRecordDate() { return recordDate; }
    public Integer getDurationOnArtMonths() { return durationOnArtMonths; }
    public ArtStage getStage() { return stage; }
    public BigDecimal getPatientWeightKg() { return patientWeightKg; }
    public String getViralLoad() { return viralLoad; }
    public String getCd4Count() { return cd4Count; }
    public String getStageDescription() { return stageDescription; }
    public UUID getSignedByUserId() { return signedByUserId; }
    public Instant getSignedAt() { return signedAt; }
}
