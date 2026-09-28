package co.ehealth.platform.patient;

public class InvalidIdentityScanException extends RuntimeException {

    public InvalidIdentityScanException(String message) {
        super(message);
    }
}