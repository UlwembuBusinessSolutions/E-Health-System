package co.ehealth.platform.patient;

// PatientDocumentService's own lookups — same shape as PatientNotFoundException.
public class PatientDocumentNotFoundException extends RuntimeException {
    public PatientDocumentNotFoundException() {
        super("Unknown patient document");
    }
}
