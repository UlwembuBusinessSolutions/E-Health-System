package co.ehealth.platform.patient;

// PatientGuardianService's own lookups — same shape as PatientNotFoundException.
public class PatientGuardianNotFoundException extends RuntimeException {
    public PatientGuardianNotFoundException() {
        super("Unknown guardian");
    }
}
