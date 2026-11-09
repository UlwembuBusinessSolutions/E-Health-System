package co.ehealth.platform.visit;

public class UnregisteredWalkInVisitException extends RuntimeException {
    public UnregisteredWalkInVisitException() {
        super("Register the patient and create a patient-linked visit before starting clinical care.");
    }
}
