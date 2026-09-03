package co.ehealth.platform.patient;

public class ReasonForChangeRequiredException extends RuntimeException {
    public ReasonForChangeRequiredException() {
        super("A reason for change is required when identity or demographic details are updated.");
    }
}