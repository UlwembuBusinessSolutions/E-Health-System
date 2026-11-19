package co.ehealth.platform.art;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "art_initiation_summaries",
        uniqueConstraints = @UniqueConstraint(name = "uq_art_initiation_summaries_visit_id", columnNames = "visit_id"))
public class ArtInitiationSummary {

    @Id
    @GeneratedValue
    private UUID id;

    @Column(name = "visit_id", nullable = false)
    private UUID visitId;

    @Column(name = "art_start_date")
    private LocalDate artStartDate;

    @Column(name = "hiv_diagnosis_year")
    private Integer hivDiagnosisYear;

    @Enumerated(EnumType.STRING)
    @Column(name = "prior_therapy", length = 20)
    private ArtPriorTherapy priorTherapy;

    @Column(columnDefinition = "TEXT")
    private String details;

    @Column(name = "created_by_user_id", nullable = false)
    private UUID createdByUserId;

    @Column(name = "updated_by_user_id", nullable = false)
    private UUID updatedByUserId;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected ArtInitiationSummary() {
    }

    public ArtInitiationSummary(UUID visitId, LocalDate artStartDate, Integer hivDiagnosisYear,
            ArtPriorTherapy priorTherapy, String details, UUID staffUserId, Instant now) {
        this.visitId = visitId;
        this.createdByUserId = staffUserId;
        this.createdAt = now;
        update(artStartDate, hivDiagnosisYear, priorTherapy, details, staffUserId, now);
    }

    public void update(LocalDate artStartDate, Integer hivDiagnosisYear, ArtPriorTherapy priorTherapy,
            String details, UUID staffUserId, Instant now) {
        this.artStartDate = artStartDate;
        this.hivDiagnosisYear = hivDiagnosisYear;
        this.priorTherapy = priorTherapy;
        this.details = details;
        this.updatedByUserId = staffUserId;
        this.updatedAt = now;
    }

    public UUID getId() {
        return id;
    }

    public UUID getVisitId() {
        return visitId;
    }

    public LocalDate getArtStartDate() {
        return artStartDate;
    }

    public Integer getHivDiagnosisYear() {
        return hivDiagnosisYear;
    }

    public ArtPriorTherapy getPriorTherapy() {
        return priorTherapy;
    }

    public String getDetails() {
        return details;
    }

    public UUID getCreatedByUserId() {
        return createdByUserId;
    }

    public UUID getUpdatedByUserId() {
        return updatedByUserId;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }
}
