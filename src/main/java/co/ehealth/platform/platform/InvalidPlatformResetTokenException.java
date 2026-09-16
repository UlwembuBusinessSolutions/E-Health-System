package co.ehealth.platform.platform;

public class InvalidPlatformResetTokenException extends RuntimeException {
    public InvalidPlatformResetTokenException() {
        super("This reset link is expired or has already been used. Request a new one.");
    }
}
