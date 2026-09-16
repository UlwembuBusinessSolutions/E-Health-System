package co.ehealth.platform.triage;

// SATS's discriminator list is what keeps triage from being "a TEWS number
// and nothing else" — certain presentations raise priority regardless of
// what the vital signs happen to read at that exact moment (a stroke
// mid-improvement can still have unremarkable vitals). This is a small,
// representative starter set, NOT the exhaustive licensed SATS discriminator
// list (ScoringProfile's own why-note applies equally here: a plausible but
// unverified list is worse than an honestly incomplete one). Each carries
// the minimum colour it forces — TewsCalculator takes the highest-urgency
// colour among every discriminator present plus the TEWS-derived colour,
// never lets a discriminator lower it.
public enum TriageDiscriminator {
    CHEST_PAIN(TriageColour.ORANGE),
    DIFFICULTY_BREATHING(TriageColour.ORANGE),
    ACTIVE_BLEEDING(TriageColour.ORANGE),
    SUSPECTED_STROKE(TriageColour.ORANGE),
    ALTERED_MENTAL_STATUS(TriageColour.ORANGE),
    SEVERE_PAIN(TriageColour.ORANGE),
    SUSPECTED_FRACTURE(TriageColour.YELLOW),
    SEVERE_DEHYDRATION(TriageColour.YELLOW),
    PREGNANCY_COMPLICATION(TriageColour.ORANGE),
    OTHER(TriageColour.YELLOW);

    private final TriageColour minimumColour;

    TriageDiscriminator(TriageColour minimumColour) {
        this.minimumColour = minimumColour;
    }

    public TriageColour getMinimumColour() {
        return minimumColour;
    }
}
