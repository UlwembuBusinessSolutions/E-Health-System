package co.ehealth.platform.triage;

import java.util.List;

/**
 * The vital-sign rules from the "Vital Signs" user story, in one place and with no Spring or database
 * dependencies, so they can be unit tested and so TriageAssessment, AdditionalObservations and any
 * future report all classify a reading the same way.
 *
 * Every classification can be returned in brackets, e.g. "(Fever)", as the story asks
 * ("The system should be able to flag and return classifications in brackets ()").
 *
 * Where the story is silent the choice made here is called out in a comment marked STORY GAP, so the
 * clinical owner can confirm or change it in one place.
 */
public final class VitalsClassifier {

    private VitalsClassifier() {
    }

    /**
     * STORY GAP: the urinalysis section says only "pH level > 7 (then Intervention Required)". By default
     * any other abnormal dipstick result is flagged "(Abnormal)" for review, but does not by itself
     * require intervention. Set to true to make every abnormal dipstick result require intervention.
     */
    public static final boolean ANY_ABNORMAL_URINE_REQUIRES_INTERVENTION = false;

    public static final List<String> HYPOGLYCEMIA_CODES = List.of("E10.0", "E11.0", "E12.0", "E13.0", "E14.0");
    public static final List<String> DIABETES_CODES = List.of("E10.9", "E11.9");
    public static final String HYPERTENSION_CODE = "I10";

    /** How much attention a result needs. Drives colour in the UI. */
    public enum Level {
        NORMAL, ATTENTION, INTERVENTION
    }

    public record Result(String label, Level level, List<String> icd10Codes, boolean interventionRequired,
                         boolean referToDietician) {

        /** The label wrapped in brackets, e.g. "(Normal)". */
        public String bracketed() {
            return "(" + label + ")";
        }
    }

    private static Result of(String label, Level level) {
        return new Result(label, level, List.of(), level == Level.INTERVENTION, false);
    }

    private static Result withCodes(String label, Level level, List<String> codes, boolean intervention) {
        return new Result(label, level, codes, intervention, false);
    }

    // 1. Body temperature ------------------------------------------------------------------------

    /**
     * Older than 5 years: fever above 37.6 C. 0 to 5 years: fever above 37.5 C.
     * A child aged exactly 5 years (60 months) is in the 0 to 5 year group.
     */
    public static Result temperature(Double celsius, Integer ageMonths) {
        if (celsius == null || ageMonths == null) return null;
        double limit = ageMonths > 60 ? 37.6 : 37.5;
        return celsius > limit ? of("Fever", Level.ATTENTION) : of("Normal", Level.NORMAL);
    }

    // 2. Respiration rate ------------------------------------------------------------------------

    public static Result respiration(Integer rate, Integer ageMonths) {
        if (rate == null || ageMonths == null) return null;
        if (ageMonths < 2) return between(rate, 30, 60);
        if (ageMonths < 12) return rate > 50 ? of("Having fast breathing", Level.ATTENTION) : of("Normal", Level.NORMAL);
        if (ageMonths < 60) return rate > 40 ? of("Having fast breathing", Level.ATTENTION) : of("Normal", Level.NORMAL);
        if (ageMonths < 120) return between(rate, 15, 27);
        return between(rate, 12, 20);
    }

    // STORY GAP: for 0-2 months, 5-10 years and 10 years+ the story gives only the normal range.
    // Anything outside it is shown as "Outside normal range" rather than being given a made-up diagnosis.
    private static Result between(int value, int low, int high) {
        return value >= low && value <= high ? of("Normal", Level.NORMAL) : of("Outside normal range", Level.ATTENTION);
    }

    // 3. Blood pressure --------------------------------------------------------------------------

    /**
     * Classified from age 18 (216 months). The story gives 120/80 as the normal reference and bands for
     * mild, moderate and severe hypertension. When systolic and diastolic fall in different bands the
     * higher band applies. Hypertension always carries ICD-10 I10 and "Medicine adjustment required".
     */
    public static Result bloodPressure(Integer systolic, Integer diastolic, Integer ageMonths) {
        if (systolic == null || diastolic == null || ageMonths == null || ageMonths < 216) return null;
        List<String> i10 = List.of(HYPERTENSION_CODE);
        if (systolic >= 180 || diastolic >= 110) {
            return withCodes("Severe Hypertension – Medicine adjustment required", Level.INTERVENTION, i10, true);
        }
        if (systolic >= 160 || diastolic >= 100) {
            return withCodes("Moderate Hypertension – Medicine adjustment required", Level.INTERVENTION, i10, true);
        }
        if (systolic >= 140 || diastolic >= 90) {
            return withCodes("Mild Hypertension – Medicine adjustment required", Level.ATTENTION, i10, true);
        }
        // STORY GAP: low readings are not in the story. They are flagged for review instead of being
        // labelled normal. Delete this block to treat every reading below 140/90 as (Normal).
        if (systolic < 90 || diastolic < 60) {
            return of("Low – review", Level.ATTENTION);
        }
        return of("Normal", Level.NORMAL);
    }

    // 4. Urinalysis ------------------------------------------------------------------------------

    /** A dipstick result such as blood, protein or nitrite: negative or normal is (Normal), anything else is (Abnormal). */
    public static Result urineDipstick(String value) {
        if (value == null || value.isBlank()) return null;
        boolean normal = "NEGATIVE".equals(value) || "NORMAL".equals(value);
        if (normal) return of("Normal", Level.NORMAL);
        return ANY_ABNORMAL_URINE_REQUIRES_INTERVENTION ? of("Intervention Required", Level.INTERVENTION)
                : of("Abnormal", Level.ATTENTION);
    }

    /** pH above 7 requires intervention. */
    public static Result urinePh(Double ph) {
        if (ph == null) return null;
        return ph > 7 ? of("Intervention Required", Level.INTERVENTION) : of("Normal", Level.NORMAL);
    }

    // 5. Blood glucose ---------------------------------------------------------------------------

    /**
     * Below 4 is hypoglycemia (E10.0, E11.0, E12.0, E13.0, E14.0). Above 11.1 is hyperglycemia
     * (E10.9, E11.9). Random below 11.1 and fasting below 7.0 are normal (E10.9, E11.9 stay available
     * because the story lists them for a known diabetic patient).
     *
     * STORY GAP: a fasting value from 7.0 up to 11.1, or a random value of exactly 11.1, is not covered.
     * It is shown as "Elevated – review" with the diabetes codes.
     * Between 4 and 11.1 the type (fasting or random) is needed; without it nothing is classified.
     */
    public static Result glucose(Double mmolPerLitre, String type) {
        if (mmolPerLitre == null) return null;
        double value = mmolPerLitre;
        if (value < 4) {
            return withCodes("Hypoglycemia – intervention required", Level.INTERVENTION, HYPOGLYCEMIA_CODES, true);
        }
        if (value > 11.1) {
            return withCodes("Hyperglycemia – Intervention", Level.INTERVENTION, DIABETES_CODES, true);
        }
        if ("FASTING".equals(type)) {
            return value < 7.0 ? withCodes("Normal", Level.NORMAL, DIABETES_CODES, false)
                    : withCodes("Elevated – review", Level.ATTENTION, DIABETES_CODES, false);
        }
        if ("RANDOM".equals(type)) {
            return value < 11.1 ? withCodes("Normal", Level.NORMAL, DIABETES_CODES, false)
                    : withCodes("Elevated – review", Level.ATTENTION, DIABETES_CODES, false);
        }
        return null;
    }

    // 8 + 9. Body mass index ---------------------------------------------------------------------

    /** Body mass in kilograms divided by height in metres squared, rounded to one decimal. */
    public static Double bmi(Double weightKg, Double heightCm) {
        if (weightKg == null || heightCm == null || heightCm <= 0 || weightKg <= 0) return null;
        double metres = heightCm / 100.0;
        return Math.round(weightKg / (metres * metres) * 10) / 10.0;
    }

    /**
     * 18.5 to under 25 is Normal. Below 18.5 is Underweight, 25.0 to 29.9 is Overweight and 30.0 or
     * more is Obese; each of those requires intervention and a Dietician referral.
     * The story's ranges meet at 25, so exactly 25.0 is classified as Overweight.
     */
    public static Result bmiClass(Double bmi) {
        if (bmi == null) return null;
        if (bmi < 18.5) return new Result("Underweight – Intervention is required, and refer to Dietician",
                Level.ATTENTION, List.of(), true, true);
        if (bmi < 25.0) return of("Normal", Level.NORMAL);
        if (bmi < 30.0) return new Result("Overweight – Intervention is required, and refer to Dietician",
                Level.ATTENTION, List.of(), true, true);
        return new Result("Obese – Intervention is required, and refer to Dietician",
                Level.ATTENTION, List.of(), true, true);
    }

    // Helpers ------------------------------------------------------------------------------------

    public static String bracketed(Result result) {
        return result == null ? null : result.bracketed();
    }
}
