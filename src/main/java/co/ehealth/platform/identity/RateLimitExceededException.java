package co.ehealth.platform.identity;

// Defined for GlobalExceptionHandler's 429 mapping, reserved for whichever
// endpoint gets real rate limiting first — nothing in this slice throws it
// yet; login and password-reset rely on the lockout/attempt-cap policies
// instead.
public class RateLimitExceededException extends RuntimeException {
}
