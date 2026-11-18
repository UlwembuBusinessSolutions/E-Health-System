package co.ehealth.platform.patient;

// A client input or state problem on the allergy record (missing ATC code, duplicate allergy, "no known
// allergies" while allergies are recorded). Mapped to 400 by PatientAllergyExceptionHandler.
public class InvalidPatientAllergyException extends RuntimeException {
    public InvalidPatientAllergyException(String message) {
        super(message);
    }
}