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
@Table(name = "art_reproductive_health_details",
        uniqueConstraints = @UniqueConstraint(name = "uq_art_reproductive_health_details_visit_id", columnNames = "visit_id"))
public class ArtReproductiveHealthDetails {

    @Id
    @GeneratedValue
    private UUID id;

    @Column(name = "visit_id", nullable = false)
    private UUID visitId;

    @Column(name = "pregnant")
    private Boolean pregnant;

    @Column(name = "trimester")
    private Integer trimester;

    @Column(columnDefinition = "TEXT")
    private String gravida;

    @Column(columnDefinition = "TEXT")
    private String para;

    @Enumerated(EnumType.STRING)
    @Column(name = "contraception_method", length = 20)
    private ContraceptionMethod contraceptionMethod;

    @Column(name = "contraception_other_specify", columnDefinition = "TEXT")
    private String contraceptionOtherSpecify;

    @Column(name = "urethral_discharge")
    private Boolean urethralDischarge;

    @Column(name = "urethral_discharge_comment", columnDefinition = "TEXT")
    private String urethralDischargeComment;

    @Column(name = "vaginal_discharge")
    private Boolean vaginalDischarge;

    @Column(name = "vaginal_discharge_comment", columnDefinition = "TEXT")
    private String vaginalDischargeComment;

    @Column(name = "genital_ulcers")
    private Boolean genitalUlcers;

    @Column(name = "genital_ulcers_comment", columnDefinition = "TEXT")
    private String genitalUlcersComment;

    @Column(name = "genital_warts")
    private Boolean genitalWarts;

    @Column(name = "genital_warts_comment", columnDefinition = "TEXT")
    private String genitalWartsComment;

    @Column(name = "lower_abdominal_pain")
    private Boolean lowerAbdominalPain;

    @Column(name = "lower_abdominal_pain_comment", columnDefinition = "TEXT")
    private String lowerAbdominalPainComment;

    @Column(name = "pap_smear_result", columnDefinition = "TEXT")
    private String papSmearResult;

    @Column(name = "pap_smear_date")
    private LocalDate papSmearDate;

    @Column(name = "rpr_date")
    private LocalDate rprDate;

    @Column(columnDefinition = "TEXT")
    private String results;

    @Column(name = "specify_treatment_completed", columnDefinition = "TEXT")
    private String specifyTreatmentCompleted;

    @Column(name = "created_by_user_id", nullable = false)
    private UUID createdByUserId;

    @Column(name = "updated_by_user_id", nullable = false)
    private UUID updatedByUserId;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected ArtReproductiveHealthDetails() {
    }

    public ArtReproductiveHealthDetails(UUID visitId, UUID staffUserId, Instant now) {
        this.visitId = visitId;
        this.createdByUserId = staffUserId;
        this.updatedByUserId = staffUserId;
        this.createdAt = now;
        this.updatedAt = now;
    }

    public void update(Boolean pregnant, Integer trimester, String gravida, String para,
            ContraceptionMethod contraceptionMethod, String contraceptionOtherSpecify,
            Boolean urethralDischarge, String urethralDischargeComment,
            Boolean vaginalDischarge, String vaginalDischargeComment,
            Boolean genitalUlcers, String genitalUlcersComment,
            Boolean genitalWarts, String genitalWartsComment,
            Boolean lowerAbdominalPain, String lowerAbdominalPainComment,
            String papSmearResult, LocalDate papSmearDate, LocalDate rprDate,
            String results, String specifyTreatmentCompleted,
            UUID staffUserId, Instant now) {
        this.pregnant = pregnant;
        this.trimester = trimester;
        this.gravida = gravida;
        this.para = para;
        this.contraceptionMethod = contraceptionMethod;
        this.contraceptionOtherSpecify = contraceptionOtherSpecify;
        this.urethralDischarge = urethralDischarge;
        this.urethralDischargeComment = urethralDischargeComment;
        this.vaginalDischarge = vaginalDischarge;
        this.vaginalDischargeComment = vaginalDischargeComment;
        this.genitalUlcers = genitalUlcers;
        this.genitalUlcersComment = genitalUlcersComment;
        this.genitalWarts = genitalWarts;
        this.genitalWartsComment = genitalWartsComment;
        this.lowerAbdominalPain = lowerAbdominalPain;
        this.lowerAbdominalPainComment = lowerAbdominalPainComment;
        this.papSmearResult = papSmearResult;
        this.papSmearDate = papSmearDate;
        this.rprDate = rprDate;
        this.results = results;
        this.specifyTreatmentCompleted = specifyTreatmentCompleted;
        this.updatedByUserId = staffUserId;
        this.updatedAt = now;
    }

    public UUID getId() {
        return id;
    }

    public UUID getVisitId() {
        return visitId;
    }

    public Boolean getPregnant() {
        return pregnant;
    }

    public Integer getTrimester() {
        return trimester;
    }

    public String getGravida() {
        return gravida;
    }

    public String getPara() {
        return para;
    }

    public ContraceptionMethod getContraceptionMethod() {
        return contraceptionMethod;
    }

    public String getContraceptionOtherSpecify() {
        return contraceptionOtherSpecify;
    }

    public Boolean getUrethralDischarge() {
        return urethralDischarge;
    }

    public String getUrethralDischargeComment() {
        return urethralDischargeComment;
    }

    public Boolean getVaginalDischarge() {
        return vaginalDischarge;
    }

    public String getVaginalDischargeComment() {
        return vaginalDischargeComment;
    }

    public Boolean getGenitalUlcers() {
        return genitalUlcers;
    }

    public String getGenitalUlcersComment() {
        return genitalUlcersComment;
    }

    public Boolean getGenitalWarts() {
        return genitalWarts;
    }

    public String getGenitalWartsComment() {
        return genitalWartsComment;
    }

    public Boolean getLowerAbdominalPain() {
        return lowerAbdominalPain;
    }

    public String getLowerAbdominalPainComment() {
        return lowerAbdominalPainComment;
    }

    public String getPapSmearResult() {
        return papSmearResult;
    }

    public LocalDate getPapSmearDate() {
        return papSmearDate;
    }

    public LocalDate getRprDate() {
        return rprDate;
    }

    public String getResults() {
        return results;
    }

    public String getSpecifyTreatmentCompleted() {
        return specifyTreatmentCompleted;
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
