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
@Table(name = "art_stage_1_conditions", uniqueConstraints = @UniqueConstraint(name = "uq_art_stage_1_conditions_visit_id", columnNames = "visit_id"))
public class ArtStage1Conditions {
    @Id @GeneratedValue private UUID id;
    @Column(name = "visit_id", nullable = false) private UUID visitId;
    private Boolean persistentGeneralizedLymphadenopathy;
    @Column(name = "stage1_other") private Boolean stage1Other;
    @Column(name = "stage1_other_specify", columnDefinition = "TEXT") private String stage1OtherSpecify;
    @Column(name = "stage2_weight_loss_under10_percent") private Boolean stage2WeightLossUnder10Percent;
    @Column(name = "stage2_minor_mucocutaneous_conditions") private Boolean stage2MinorMucocutaneousConditions;
    @Column(name = "stage2_recurrent_urti") private Boolean stage2RecurrentUrti;
    @Column(name = "stage2_other") private Boolean stage2Other;
    @Column(name = "stage2_other_specify", columnDefinition = "TEXT") private String stage2OtherSpecify;
    @Column(name = "stage3_weight_loss_over10_percent") private Boolean stage3WeightLossOver10Percent;
    @Column(name = "stage3_diarrhoea_over_one_month") private Boolean stage3DiarrhoeaOverOneMonth;
    @Column(name = "stage3_oral_candidiasis") private Boolean stage3OralCandidiasis;
    @Column(name = "stage3_severe_bacterial_infections") private Boolean stage3SevereBacterialInfections;
    @Column(name = "stage3_oral_hairy_leukoplakia") private Boolean stage3OralHairyLeukoplakia;
    @Column(name = "stage3_prolonged_fever") private Boolean stage3ProlongedFever;
    @Column(name = "stage3_bedridden_under50_percent") private Boolean stage3BedriddenUnder50Percent;
    @Column(name = "stage3_pulmonary_tb") private Boolean stage3PulmonaryTb;
    @Column(name = "stage3_other") private Boolean stage3Other;
    @Column(name = "stage3_other_specify", columnDefinition = "TEXT") private String stage3OtherSpecify;
    @Column(name = "stage4_herpes_simplex_over_one_month") private Boolean stage4HerpesSimplexOverOneMonth;
    @Column(name = "stage4_oesophageal_candidiasis") private Boolean stage4OesophagealCandidiasis;
    @Column(name = "stage4_pneumocystis_jiroveci") private Boolean stage4PneumocystisJiroveci;
    @Column(name = "stage4_kaposis_sarcoma") private Boolean stage4KaposisSarcoma;
    @Column(name = "stage4_hiv_wasting_syndrome") private Boolean stage4HivWastingSyndrome;
    @Column(name = "stage4_hiv_encephalopathy") private Boolean stage4HivEncephalopathy;
    @Column(name = "stage4_recurrent_pneumonia") private Boolean stage4RecurrentPneumonia;
    @Column(name = "stage4_cytomegalovirus") private Boolean stage4Cytomegalovirus;
    @Column(name = "stage4_isosporiasis_cryptosporidiosis") private Boolean stage4IsosporiasisCryptosporidiosis;
    @Column(name = "stage4_bedridden_over50_percent") private Boolean stage4BedriddenOver50Percent;
    @Column(name = "stage4_cryptococcal_meningitis") private Boolean stage4CryptococcalMeningitis;
    @Column(name = "stage4_cervical_cancer") private Boolean stage4CervicalCancer;
    @Column(name = "stage4_lymphoma") private Boolean stage4Lymphoma;
    @Column(name = "stage4_extra_pulmonary_tb") private Boolean stage4ExtraPulmonaryTb;
    @Column(name = "cd4_result", columnDefinition = "TEXT") private String cd4Result;
    @Column(name = "created_by_user_id", nullable = false) private UUID createdByUserId;
    @Column(name = "updated_by_user_id", nullable = false) private UUID updatedByUserId;
    @Column(name = "created_at", nullable = false) private Instant createdAt;
    @Column(name = "updated_at", nullable = false) private Instant updatedAt;

    protected ArtStage1Conditions() {}
    public ArtStage1Conditions(UUID visitId, UUID userId, Instant now) {
        this.visitId = visitId; this.createdByUserId = userId; this.updatedByUserId = userId; this.createdAt = now; this.updatedAt = now;
    }
    public void update(ArtStage1ConditionsController.SaveRequest r, UUID userId, Instant now) {
        persistentGeneralizedLymphadenopathy = r.persistentGeneralizedLymphadenopathy();
        stage1Other = r.stage1Other(); stage1OtherSpecify = norm(r.stage1OtherSpecify());
        stage2WeightLossUnder10Percent = r.stage2WeightLossUnder10Percent();
        stage2MinorMucocutaneousConditions = r.stage2MinorMucocutaneousConditions(); stage2RecurrentUrti = r.stage2RecurrentUrti();
        stage2Other = r.stage2Other(); stage2OtherSpecify = norm(r.stage2OtherSpecify());
        stage3WeightLossOver10Percent = r.stage3WeightLossOver10Percent(); stage3DiarrhoeaOverOneMonth = r.stage3DiarrhoeaOverOneMonth();
        stage3OralCandidiasis = r.stage3OralCandidiasis(); stage3SevereBacterialInfections = r.stage3SevereBacterialInfections();
        stage3OralHairyLeukoplakia = r.stage3OralHairyLeukoplakia(); stage3ProlongedFever = r.stage3ProlongedFever();
        stage3BedriddenUnder50Percent = r.stage3BedriddenUnder50Percent(); stage3PulmonaryTb = r.stage3PulmonaryTb();
        stage3Other = r.stage3Other(); stage3OtherSpecify = norm(r.stage3OtherSpecify());
        stage4HerpesSimplexOverOneMonth = r.stage4HerpesSimplexOverOneMonth(); stage4OesophagealCandidiasis = r.stage4OesophagealCandidiasis();
        stage4PneumocystisJiroveci = r.stage4PneumocystisJiroveci(); stage4KaposisSarcoma = r.stage4KaposisSarcoma();
        stage4HivWastingSyndrome = r.stage4HivWastingSyndrome(); stage4HivEncephalopathy = r.stage4HivEncephalopathy();
        stage4RecurrentPneumonia = r.stage4RecurrentPneumonia(); stage4Cytomegalovirus = r.stage4Cytomegalovirus();
        stage4IsosporiasisCryptosporidiosis = r.stage4IsosporiasisCryptosporidiosis(); stage4BedriddenOver50Percent = r.stage4BedriddenOver50Percent();
        stage4CryptococcalMeningitis = r.stage4CryptococcalMeningitis(); stage4CervicalCancer = r.stage4CervicalCancer();
        stage4Lymphoma = r.stage4Lymphoma(); stage4ExtraPulmonaryTb = r.stage4ExtraPulmonaryTb(); cd4Result = norm(r.cd4Result());
        updatedByUserId = userId; updatedAt = now;
    }
    private static String norm(String s) { return s == null || s.isBlank() ? null : s.trim(); }
    public UUID getId() { return id; } public UUID getVisitId() { return visitId; }
    public Boolean getPersistentGeneralizedLymphadenopathy() { return persistentGeneralizedLymphadenopathy; }
    public Boolean getStage1Other() { return stage1Other; } public String getStage1OtherSpecify() { return stage1OtherSpecify; }
    public Boolean getStage2WeightLossUnder10Percent() { return stage2WeightLossUnder10Percent; }
    public Boolean getStage2MinorMucocutaneousConditions() { return stage2MinorMucocutaneousConditions; }
    public Boolean getStage2RecurrentUrti() { return stage2RecurrentUrti; } public Boolean getStage2Other() { return stage2Other; }
    public String getStage2OtherSpecify() { return stage2OtherSpecify; }
    public Boolean getStage3WeightLossOver10Percent() { return stage3WeightLossOver10Percent; }
    public Boolean getStage3DiarrhoeaOverOneMonth() { return stage3DiarrhoeaOverOneMonth; }
    public Boolean getStage3OralCandidiasis() { return stage3OralCandidiasis; }
    public Boolean getStage3SevereBacterialInfections() { return stage3SevereBacterialInfections; }
    public Boolean getStage3OralHairyLeukoplakia() { return stage3OralHairyLeukoplakia; }
    public Boolean getStage3ProlongedFever() { return stage3ProlongedFever; }
    public Boolean getStage3BedriddenUnder50Percent() { return stage3BedriddenUnder50Percent; }
    public Boolean getStage3PulmonaryTb() { return stage3PulmonaryTb; } public Boolean getStage3Other() { return stage3Other; }
    public String getStage3OtherSpecify() { return stage3OtherSpecify; }
    public Boolean getStage4HerpesSimplexOverOneMonth() { return stage4HerpesSimplexOverOneMonth; }
    public Boolean getStage4OesophagealCandidiasis() { return stage4OesophagealCandidiasis; }
    public Boolean getStage4PneumocystisJiroveci() { return stage4PneumocystisJiroveci; }
    public Boolean getStage4KaposisSarcoma() { return stage4KaposisSarcoma; } public Boolean getStage4HivWastingSyndrome() { return stage4HivWastingSyndrome; }
    public Boolean getStage4HivEncephalopathy() { return stage4HivEncephalopathy; }
    public Boolean getStage4RecurrentPneumonia() { return stage4RecurrentPneumonia; }
    public Boolean getStage4Cytomegalovirus() { return stage4Cytomegalovirus; }
    public Boolean getStage4IsosporiasisCryptosporidiosis() { return stage4IsosporiasisCryptosporidiosis; }
    public Boolean getStage4BedriddenOver50Percent() { return stage4BedriddenOver50Percent; }
    public Boolean getStage4CryptococcalMeningitis() { return stage4CryptococcalMeningitis; }
    public Boolean getStage4CervicalCancer() { return stage4CervicalCancer; } public Boolean getStage4Lymphoma() { return stage4Lymphoma; }
    public Boolean getStage4ExtraPulmonaryTb() { return stage4ExtraPulmonaryTb; } public String getCd4Result() { return cd4Result; }
    public UUID getUpdatedByUserId() { return updatedByUserId; } public Instant getCreatedAt() { return createdAt; } public Instant getUpdatedAt() { return updatedAt; }
}
