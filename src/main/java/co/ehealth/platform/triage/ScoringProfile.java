package co.ehealth.platform.triage;

// SATS scores adults and children on different tables — applying an adult
// table to a child (or vice versa) is a real clinical-safety error, not a
// cosmetic one (TriageAssessmentPlan.md §1.2's own why-note). Derived from
// the patient's age at the time of observation where possible; the
// clinician can confirm/override it when age alone isn't a confident
// signal (see TriageService.deriveScoringProfile()).
//
// PAEDIATRIC numeric TEWS tables are NOT implemented in TewsCalculator —
// deliberately: this codebase doesn't have confident, clinically-verified
// point tables for child vital-sign ranges to encode, and a plausible-
// looking but unverified number is worse than none. A PAEDIATRIC_* profile
// still gets emergency-sign and discriminator handling in full; the
// TEWS-derived colour is left absent and the capturing clinician must
// select the colour manually until real paediatric tables are signed off.
public enum ScoringProfile {
    ADULT,
    PAEDIATRIC_OLDER_CHILD,
    PAEDIATRIC_YOUNGER_CHILD
}
