package co.ehealth.platform.triage;

import java.util.Comparator;
import java.util.Set;

// The Triage Early Warning Score calculation, isolated from TriageService
// on purpose: no Spring dependencies, no database access, nothing but pure
// arithmetic over the values it's handed — trivial to unit test exhaustively
// against approved fixtures, and trivial to correct in one place once the
// real numbers are signed off (see the why-note on SCORING_VERSION below).
//
// Adult bands checked against SATS Training Manual 2012, pp. 8 and 26:
// https://emssa.org.za/wp-content/uploads/2017/10/SATS-Manual.pdf
// Deployment-specific clinical approval and the full discriminator workflow are
// still outstanding; retain the draft version and historical scoring snapshots.
public class TewsCalculator {

    // Bump this string every time the point bands or colour thresholds
    // change — TriageAssessment.scoringVersion is copied from here at
    // capture time and never recalculated later, so a changed constant
    // here only affects assessments captured after the change.
    public static final String SCORING_VERSION = "SATS-DRAFT-2026.2";

    public record Result(Integer tewsScore, TriageColour calculatedColour) {
    }

    // emergencySign short-circuits everything else: SATS's own workflow is
    // emergency signs first, and a patient with one gets Red immediately,
    // full stop — no TEWS is computed, no discriminators are consulted,
    // because none of that changes an already-maximal outcome and none of
    // it should delay care while a form gets filled in.
    public Result calculate(boolean emergencySign, ScoringProfile profile, Integer respiratoryRate,
                             Integer heartRate, Integer systolicBp, Double temperatureCelsius, Avpu avpu,
                             Mobility mobility, Set<TriageDiscriminator> discriminators, AdditionalObservations additional) {
        if (emergencySign || (additional != null && additional.glucoseMmolL != null && additional.glucoseMmolL < 3)) {
            return new Result(null, TriageColour.RED);
        }

        TriageColour discriminatorColour = discriminators.stream().map(TriageDiscriminator::getMinimumColour)
                .max(Comparator.naturalOrder()).orElse(TriageColour.GREEN);

        // ScoringProfile's own why-note — no verified paediatric point
        // table exists here yet. Discriminators and emergency signs still
        // apply in full (neither is age-specific arithmetic); the numeric
        // TEWS is simply never computed, leaving TriageService to require
        // the capturing clinician to confirm a colour by hand instead.
        if (profile != ScoringProfile.ADULT) {
            return new Result(null, discriminatorColour);
        }

        int score = scoreRespiratoryRate(respiratoryRate) + scoreHeartRate(heartRate) + scoreSystolicBp(systolicBp)
                + scoreTemperature(temperatureCelsius) + scoreAvpu(avpu) + scoreMobility(mobility)
                + (additional != null && Boolean.TRUE.equals(additional.traumaPresent) ? 1 : 0);
        TriageColour tewsColour = colourForScore(score);
        if (avpu != Avpu.ALERT && discriminatorColour.compareTo(TriageColour.ORANGE) < 0)
            discriminatorColour = TriageColour.ORANGE;
        TriageColour finalColour = tewsColour.compareTo(discriminatorColour) >= 0 ? tewsColour : discriminatorColour;
        return new Result(score, finalColour);
    }

    private int scoreRespiratoryRate(int rr) {
        if (rr < 9 || rr > 29) return 3;
        if (rr >= 21) return 2;
        if (rr >= 15) return 0;
        return 1;
    }

    private int scoreHeartRate(int hr) {
        if (hr < 41 || hr >= 130) return 3;
        if (hr >= 111) return 2;
        if (hr >= 101) return 1;
        if (hr >= 51) return 0;
        return 1;
    }

    private int scoreSystolicBp(int sbp) {
        if (sbp <= 70) return 3;
        if (sbp <= 80) return 2;
        if (sbp <= 100) return 1;
        if (sbp <= 199) return 0;
        return 2;
    }

    private int scoreTemperature(double tempCelsius) {
        return (tempCelsius < 35.0 || tempCelsius >= 38.5) ? 2 : 0;
    }

    private int scoreAvpu(Avpu avpu) {
        return switch (avpu) { case ALERT -> 0; case CONFUSED -> 2; case VOICE -> 1; case PAIN -> 2; case UNRESPONSIVE -> 3; };
    }

    private int scoreMobility(Mobility mobility) {
        return switch (mobility) {
            case WALKING -> 0;
            case MOBILE_WITH_ASSISTANCE -> 1;
            case IMMOBILE -> 2;
        };
    }

    private TriageColour colourForScore(int score) {
        if (score >= 7) return TriageColour.RED;
        if (score >= 5) return TriageColour.ORANGE;
        if (score >= 3) return TriageColour.YELLOW;
        return TriageColour.GREEN;
    }
}
