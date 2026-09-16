package co.ehealth.platform.triage;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import java.util.Set;

/** Optional observations, stored with the assessment. Null means not recorded. */
@Embeddable
public class AdditionalObservations {
    @Column(name = "trauma_present")
    public Boolean traumaPresent;
    @Column(name = "weight_kg")
    public Double weightKg;
    @Column(name = "height_cm")
    public Double heightCm;
    @Column(name = "glucose_mmol_l")
    public Double glucoseMmolL;
    @Column(name = "haemoglobin_gdl")
    public Double haemoglobinGdl;
    @Column(name = "urine_protein", length = 20)
    public String urineProtein;
    @Column(name = "urine_glucose", length = 20)
    public String urineGlucose;
    @Column(name = "urine_ketones", length = 20)
    public String urineKetones;
    @Column(name = "urine_blood", length = 20)
    public String urineBlood;
    @Column(name = "urine_leukocytes", length = 20)
    public String urineLeukocytes;
    @Column(name = "urine_nitrites", length = 20)
    public String urineNitrites;
    @Column(name = "pregnancy_test", length = 20)
    public String pregnancyTest;

    @com.fasterxml.jackson.annotation.JsonProperty(access = com.fasterxml.jackson.annotation.JsonProperty.Access.READ_ONLY)
    public Double getBmi() {
        return weightKg == null || heightCm == null || heightCm <= 0 ? null
                : Math.round(weightKg / Math.pow(heightCm / 100, 2) * 10) / 10.0;
    }

    public void validate() {
        positive(weightKg, "Weight (kg)");
        positive(heightCm, "Height (cm)");
        positive(glucoseMmolL, "Blood glucose (mmol/L)");
        positive(haemoglobinGdl, "Haemoglobin (g/dL)");
        result(urineProtein, Set.of("NEGATIVE", "TRACE", "ONE_PLUS", "TWO_PLUS", "THREE_PLUS", "FOUR_PLUS"), "urine protein");
        result(urineGlucose, Set.of("NEGATIVE", "TRACE", "ONE_PLUS", "TWO_PLUS", "THREE_PLUS", "FOUR_PLUS"), "urine glucose");
        result(urineKetones, Set.of("NEGATIVE", "TRACE", "ONE_PLUS", "TWO_PLUS", "THREE_PLUS", "FOUR_PLUS"), "urine ketones");
        result(urineBlood, Set.of("NEGATIVE", "TRACE", "ONE_PLUS", "TWO_PLUS", "THREE_PLUS", "FOUR_PLUS"), "urine blood");
        result(urineLeukocytes, Set.of("NEGATIVE", "TRACE", "ONE_PLUS", "TWO_PLUS", "THREE_PLUS", "FOUR_PLUS"), "urine leukocytes");
        result(urineNitrites, Set.of("NEGATIVE", "POSITIVE"), "urine nitrites");
        result(pregnancyTest, Set.of("NEGATIVE", "POSITIVE", "INDETERMINATE"), "pregnancy test");
    }
    private static void positive(Double value, String label) {
        if (value != null && (!Double.isFinite(value) || value <= 0))
            throw new InvalidTriageCaptureException(label + " must be a finite number greater than zero.");
    }
    private static void result(String value, Set<String> allowed, String label) {
        if (value != null && !allowed.contains(value))
            throw new InvalidTriageCaptureException("Invalid result for " + label + ".");
    }
}
