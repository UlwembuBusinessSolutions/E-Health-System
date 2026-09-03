package co.ehealth.platform.patient;

public class InvalidIdNumberException extends RuntimeException {
    public InvalidIdNumberException() {
        super("Not a valid South African ID number.");
    }
}
