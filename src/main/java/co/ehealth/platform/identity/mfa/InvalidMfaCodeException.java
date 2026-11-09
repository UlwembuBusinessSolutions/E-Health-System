package co.ehealth.platform.identity.mfa;

public class InvalidMfaCodeException extends RuntimeException {
    public InvalidMfaCodeException() {
        super("Incorrect or expired code.");
    }

    public InvalidMfaCodeException(String message) {
        super(message);
    }
}