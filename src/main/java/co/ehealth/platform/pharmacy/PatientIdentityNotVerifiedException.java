package co.ehealth.platform.pharmacy;

public class PatientIdentityNotVerifiedException extends RuntimeException {
    public PatientIdentityNotVerifiedException(String message) {
        super(message);
    }
}
