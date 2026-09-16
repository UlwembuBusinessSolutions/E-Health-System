package co.ehealth.platform.triage;

// South African Triage Scale discriminator colours, in ascending order of
// urgency — TriageColour.compareTo() / max() relies on that ordering (see
// TewsCalculator's own why-note), so this enum's declaration order is load
// bearing, not incidental.
public enum TriageColour {
    GREEN,
    YELLOW,
    ORANGE,
    RED
}
