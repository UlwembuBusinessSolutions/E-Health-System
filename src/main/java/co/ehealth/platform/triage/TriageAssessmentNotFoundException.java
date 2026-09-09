package co.ehealth.platform.triage;

public class TriageAssessmentNotFoundException extends RuntimeException {
    public TriageAssessmentNotFoundException() { super("Triage assessment not found."); }
}
