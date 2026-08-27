package co.ehealth.platform.platform;

// Same reasoning as OrganizationNotFoundException's own why-note — a clean
// 404 for resetPassword()/setEnabled() targeting an unknown operator id,
// rather than an unhandled Optional.orElseThrow(NoSuchElementException)
// falling through to a bare 500.
public class PlatformOperatorNotFoundException extends RuntimeException {
    public PlatformOperatorNotFoundException() {
        super("Unknown platform operator");
    }
}
