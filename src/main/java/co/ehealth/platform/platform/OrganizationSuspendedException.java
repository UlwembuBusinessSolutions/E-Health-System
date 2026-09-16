package co.ehealth.platform.platform;

// Replaces a generic IllegalStateException that OrganizationProvisioningService
// threw when addAdmins() targeted a SUSPENDED organization — uncaught, fell
// through to a bare 500 instead of a 409 ("conflicts with current state,"
// exactly what 409 means, and exactly the same reasoning already applied to
// DataIntegrityViolationException elsewhere in GlobalExceptionHandler).
public class OrganizationSuspendedException extends RuntimeException {
    public OrganizationSuspendedException(String message) {
        super(message);
    }
}
