package co.ehealth.platform.triage;

public class TriageAssessmentNotFoundException extends RuntimeException {
    public TriageAssessmentNotFoundException() {
        super("Unknown triage assessment");
    }
}
