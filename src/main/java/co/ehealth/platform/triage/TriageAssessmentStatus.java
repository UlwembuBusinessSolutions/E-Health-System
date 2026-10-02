package co.ehealth.platform.triage;

// An assessment is written once and never edited in place — the exact
// problem queue_tokens' wide nullable columns had (a later transition
// silently overwriting the record that an earlier one ever happened).
// SUPERSEDED and ENTERED_IN_ERROR both mean "not current" but are kept
// distinct: SUPERSEDED has a real replacement (supersedesAssessmentId on
// the newer row points back to it); ENTERED_IN_ERROR does not — it was
// simply wrong (wrong patient, fat-fingered) with nothing to replace it.
public enum TriageAssessmentStatus {
    ACTIVE,
    SUPERSEDED,
    ENTERED_IN_ERROR
}
