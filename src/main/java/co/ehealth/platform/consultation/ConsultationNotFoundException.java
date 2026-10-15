package co.ehealth.platform.consultation;

// ConsultationService's various lookups-by-id — the target consultationId
// doesn't exist. Same shape as VisitNotFoundException/TriageAssessmentNotFoundException.
public class ConsultationNotFoundException extends RuntimeException {
    public ConsultationNotFoundException() {
        super("Unknown consultation");
    }
}
