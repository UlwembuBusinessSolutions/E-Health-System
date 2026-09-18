package co.ehealth.platform.triage;

// lihle | 2026-09-09 | Connected persisted triage reads and validation to the UI while restricting records to the active clinic.

public class TriageAssessmentNotFoundException extends RuntimeException {
    public TriageAssessmentNotFoundException() { super("Triage assessment not found."); }
}
