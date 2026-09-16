package co.ehealth.platform.patient;

public class MinorNextOfKinRequiredException extends RuntimeException {

    public MinorNextOfKinRequiredException() {
        super("At least one next-of-kin or guardian is required for a minor.");
    }
}