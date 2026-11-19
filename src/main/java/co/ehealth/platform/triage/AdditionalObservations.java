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
    @Column(name = "urine_urobilinogen", length = 30)
    public String urineUrobilinogen;
    @Column(name = "urine_bilirubin", length = 20)
    public String urineBilirubin;
    @Column(name = "urine_ph")
    public Double urinePh;
    @Column(name = "glucose_type", length = 20)
    public String glucoseType;
    @Column(name = "pregnancy_test", length = 20)
    public String pregnancyTest;

    @com.fasterxml.jackson.annotation.JsonProperty(access = com.fasterxml.jackson.annotation.JsonProperty.Access.READ_ONLY)
    public Double getBmi() {
        return weightKg == null || heightCm == null || heightCm <= 0 ? null
                : Math.round(weightKg / Math.pow(heightCm / 100, 2) * 10) / 10.0;
    }

    @com.fasterxml.jackson.annotation.JsonProperty(access = com.fasterxml.jackson.annotation.JsonProperty.Access.READ_ONLY)
    public String getBmiClassification() {
        return VitalsClassifier.bracketed(VitalsClassifier.bmiClass(getBmi()));
    }

    /** True when BMI is underweight, overweight or obese: the story says to refer to a Dietician. */
    @com.fasterxml.jackson.annotation.JsonProperty(access = com.fasterxml.jackson.annotation.JsonProperty.Access.READ_ONLY)
    public boolean isDieticianReferralRequired() {
        VitalsClassifier.Result result = VitalsClassifier.bmiClass(getBmi());
        return result != null && result.referToDietician();
    }

    @com.fasterxml.jackson.annotation.JsonProperty(access = com.fasterxml.jackson.annotation.JsonProperty.Access.READ_ONLY)
    public String getGlucoseClassification() {
        return VitalsClassifier.bracketed(VitalsClassifier.glucose(glucoseMmolL, glucoseType));
    }

    @com.fasterxml.jackson.annotation.JsonProperty(access = com.fasterxml.jackson.annotation.JsonProperty.Access.READ_ONLY)
    public String getUrinePhClassification() {
        return VitalsClassifier.bracketed(VitalsClassifier.urinePh(urinePh));
    }

    /** Each recorded urinalysis item with its bracketed classification, e.g. {"Protein": "(Abnormal)"}. */
    @com.fasterxml.jackson.annotation.JsonProperty(access = com.fasterxml.jackson.annotation.JsonProperty.Access.READ_ONLY)
    public java.util.Map<String, String> getUrinalysisFindings() {
        java.util.Map<String, String> findings = new java.util.LinkedHashMap<>();
        put(findings, "Blood", VitalsClassifier.urineDipstick(urineBlood));
        put(findings, "Urobilinogen", VitalsClassifier.urineDipstick(urineUrobilinogen));
        put(findings, "Bilirubin", VitalsClassifier.urineDipstick(urineBilirubin));
        put(findings, "Glucose", VitalsClassifier.urineDipstick(urineGlucose));
        put(findings, "Leukocytes", VitalsClassifier.urineDipstick(urineLeukocytes));
        put(findings, "Protein", VitalsClassifier.urineDipstick(urineProtein));
        put(findings, "Nitrate", VitalsClassifier.urineDipstick(urineNitrites));
        put(findings, "Ketones", VitalsClassifier.urineDipstick(urineKetones));
        put(findings, "pH", VitalsClassifier.urinePh(urinePh));
        return findings;
    }

    private static void put(java.util.Map<String, String> map, String key, VitalsClassifier.Result result) {
        if (result != null) map.put(key, result.bracketed());
    }

    @com.fasterxml.jackson.annotation.JsonProperty(access = com.fasterxml.jackson.annotation.JsonProperty.Access.READ_ONLY)
    public boolean isUrinalysisInterventionRequired() {
        return getUrinalysisFindings().values().stream().anyMatch("(Intervention Required)"::equals);
    }

    /** ICD-10 codes the glucose result points to (diabetes codes, or the hypoglycemia codes). */
    public java.util.List<String> icd10Indications() {
        VitalsClassifier.Result glucose = VitalsClassifier.glucose(glucoseMmolL, glucoseType);
        return glucose == null ? java.util.List.of() : glucose.icd10Codes();
    }

    public void validate() {
        positive(weightKg, "Weight (kg)");
        positive(heightCm, "Height (cm)");
        if (glucoseMmolL != null && (!Double.isFinite(glucoseMmolL) || glucoseMmolL < 0))
            throw new InvalidTriageCaptureException("Blood glucose must be a finite number of zero or more.");
        positive(haemoglobinGdl, "Haemoglobin (g/dL)");
        result(urineProtein, Set.of("NEGATIVE", "TRACE", "ONE_PLUS", "TWO_PLUS", "THREE_PLUS", "FOUR_PLUS"), "urine protein");
        result(urineGlucose, Set.of("NEGATIVE", "TRACE", "ONE_PLUS", "TWO_PLUS", "THREE_PLUS", "FOUR_PLUS"), "urine glucose");
        result(urineKetones, Set.of("NEGATIVE", "TRACE", "ONE_PLUS", "TWO_PLUS", "THREE_PLUS", "FOUR_PLUS"), "urine ketones");
        result(urineBlood, Set.of("NEGATIVE", "TRACE", "ONE_PLUS", "TWO_PLUS", "THREE_PLUS", "FOUR_PLUS"), "urine blood");
        result(urineLeukocytes, Set.of("NEGATIVE", "TRACE", "ONE_PLUS", "TWO_PLUS", "THREE_PLUS", "FOUR_PLUS"), "urine leukocytes");
        result(urineNitrites, Set.of("NEGATIVE", "POSITIVE"), "urine nitrites");
        result(pregnancyTest, Set.of("NEGATIVE", "POSITIVE", "INDETERMINATE"), "pregnancy test");
        result(glucoseType, Set.of("FASTING", "RANDOM"), "glucose type");
        result(urineUrobilinogen, Set.of("NORMAL", "ELEVATED"), "urine urobilinogen");
        result(urineBilirubin, Set.of("NEGATIVE", "POSITIVE"), "urine bilirubin");
        if (urinePh != null && (!Double.isFinite(urinePh) || urinePh < 0 || urinePh > 14))
            throw new InvalidTriageCaptureException("Urine pH must be between 0 and 14.");
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
