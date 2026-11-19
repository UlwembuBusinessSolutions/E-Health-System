package co.ehealth.platform.art;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "art_initiation_tb_screening",
        uniqueConstraints = @UniqueConstraint(name = "uq_art_initiation_tb_screening_visit_id", columnNames = "visit_id"))
public class ArtInitiationTbScreening {
    @Id
    @GeneratedValue
    private UUID id;

    @Column(name = "visit_id", nullable = false)
    private UUID visitId;

    private Boolean previousTb;
    private Integer previousTbYear;
    private Boolean previousTbExtraPulmonary;
    private Boolean previousTbPulmonary;
    private Boolean currentTb;
    private Boolean currentTbExtraPulmonary;
    private Boolean currentTbPulmonary;
    private LocalDate currentTbTreatmentStartDate;
    private Boolean symptomCoughOverTwoWeeks;
    private Boolean symptomWeightLoss;
    private Boolean symptomFever;
    private Boolean symptomNightSweats;
    private Boolean symptomHaemoptysis;
    private Boolean symptomFatigue;

    @Column(name = "smear_date_result", columnDefinition = "TEXT")
    private String smearDateResult;

    private LocalDate cultureSensitivityDateResult;

    @Column(columnDefinition = "TEXT")
    private String clinicalIndication;

    @Column(name = "created_by_user_id", nullable = false)
    private UUID createdByUserId;

    @Column(name = "updated_by_user_id", nullable = false)
    private UUID updatedByUserId;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected ArtInitiationTbScreening() {}

    public ArtInitiationTbScreening(UUID visitId, UUID userId, Instant now) {
        this.visitId = visitId;
        this.createdByUserId = userId;
        this.createdAt = now;
        this.updatedByUserId = userId;
        this.updatedAt = now;
    }

    public void update(ArtInitiationTbScreeningController.SaveRequest request, UUID userId, Instant now) {
        boolean hadPreviousTb = Boolean.TRUE.equals(request.previousTb());
        boolean hasCurrentTb = Boolean.TRUE.equals(request.currentTb());
        this.previousTb = request.previousTb();
        this.previousTbYear = hadPreviousTb ? request.previousTbYear() : null;
        this.previousTbExtraPulmonary = hadPreviousTb ? request.previousTbExtraPulmonary() : null;
        this.previousTbPulmonary = hadPreviousTb ? request.previousTbPulmonary() : null;
        this.currentTb = request.currentTb();
        this.currentTbExtraPulmonary = hasCurrentTb ? request.currentTbExtraPulmonary() : null;
        this.currentTbPulmonary = hasCurrentTb ? request.currentTbPulmonary() : null;
        this.currentTbTreatmentStartDate = hasCurrentTb ? request.currentTbTreatmentStartDate() : null;
        this.symptomCoughOverTwoWeeks = request.symptomCoughOverTwoWeeks();
        this.symptomWeightLoss = request.symptomWeightLoss();
        this.symptomFever = request.symptomFever();
        this.symptomNightSweats = request.symptomNightSweats();
        this.symptomHaemoptysis = request.symptomHaemoptysis();
        this.symptomFatigue = request.symptomFatigue();
        this.smearDateResult = normalize(request.smearDateResult());
        this.cultureSensitivityDateResult = request.cultureSensitivityDateResult();
        this.clinicalIndication = normalize(request.clinicalIndication());
        this.updatedByUserId = userId;
        this.updatedAt = now;
    }

    private static String normalize(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    public UUID getId() { return id; }
    public UUID getVisitId() { return visitId; }
    public Boolean getPreviousTb() { return previousTb; }
    public Integer getPreviousTbYear() { return previousTbYear; }
    public Boolean getPreviousTbExtraPulmonary() { return previousTbExtraPulmonary; }
    public Boolean getPreviousTbPulmonary() { return previousTbPulmonary; }
    public Boolean getCurrentTb() { return currentTb; }
    public Boolean getCurrentTbExtraPulmonary() { return currentTbExtraPulmonary; }
    public Boolean getCurrentTbPulmonary() { return currentTbPulmonary; }
    public LocalDate getCurrentTbTreatmentStartDate() { return currentTbTreatmentStartDate; }
    public Boolean getSymptomCoughOverTwoWeeks() { return symptomCoughOverTwoWeeks; }
    public Boolean getSymptomWeightLoss() { return symptomWeightLoss; }
    public Boolean getSymptomFever() { return symptomFever; }
    public Boolean getSymptomNightSweats() { return symptomNightSweats; }
    public Boolean getSymptomHaemoptysis() { return symptomHaemoptysis; }
    public Boolean getSymptomFatigue() { return symptomFatigue; }
    public String getSmearDateResult() { return smearDateResult; }
    public LocalDate getCultureSensitivityDateResult() { return cultureSensitivityDateResult; }
    public String getClinicalIndication() { return clinicalIndication; }
    public UUID getUpdatedByUserId() { return updatedByUserId; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
}
