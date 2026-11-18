package co.ehealth.platform.patient;

// PatientAllergyService's own lookups — same shape as PatientGuardianNotFoundException.
public class PatientAllergyNotFoundException extends RuntimeException {
    public PatientAllergyNotFoundException() {
        super("Unknown allergy");
    }
}