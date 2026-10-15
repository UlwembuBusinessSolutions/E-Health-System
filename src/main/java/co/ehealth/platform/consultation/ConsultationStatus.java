package co.ehealth.platform.consultation;

// DRAFT while being authored; SIGNED once locked by the clinician;
// SUPERSEDED once a later amendment replaces it; ENTERED_IN_ERROR for a
// pure mistake with nothing to replace it — the same four-way split
// TriageAssessmentStatus established for vitals, extended with DRAFT since
// (unlike a single vitals reading) a consultation has a real multi-step
// authoring phase before it becomes a fact of record.
public enum ConsultationStatus {
    DRAFT, SIGNED, SUPERSEDED, ENTERED_IN_ERROR
}
