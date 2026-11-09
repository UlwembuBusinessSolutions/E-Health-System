package co.ehealth.platform.identity.mfa;

public class MfaChallengeExpiredException extends RuntimeException {
    public MfaChallengeExpiredException() {
        super("Your sign-in attempt has expired. Please sign in again.");
    }
}