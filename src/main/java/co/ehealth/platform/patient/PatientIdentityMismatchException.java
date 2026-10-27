package co.ehealth.platform.patient;

/** Existing clinical records may only be linked when submitted identity details match the record. */
public class PatientIdentityMismatchException extends RuntimeException {
    public PatientIdentityMismatchException() {
        super("We couldn't verify these details against a clinic record. Please contact your clinic for help.");
    }
}
