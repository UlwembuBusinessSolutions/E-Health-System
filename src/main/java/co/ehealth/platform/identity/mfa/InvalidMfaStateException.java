package co.ehealth.platform.identity.mfa;

public class InvalidMfaStateException extends RuntimeException {
    public InvalidMfaStateException(String message) {
        super(message);
    }
}