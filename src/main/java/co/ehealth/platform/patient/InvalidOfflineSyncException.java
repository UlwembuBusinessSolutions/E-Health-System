package co.ehealth.platform.patient;

public class InvalidOfflineSyncException extends RuntimeException {
    public InvalidOfflineSyncException(String message) {
        super(message);
    }
}