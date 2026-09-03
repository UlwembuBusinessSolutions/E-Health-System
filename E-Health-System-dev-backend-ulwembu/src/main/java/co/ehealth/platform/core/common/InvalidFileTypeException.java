package co.ehealth.platform.core.common;

// Moved here from identity — file-type validation isn't staff-specific
// anymore now that OrganizationBrandingService (core/tenant) uploads logos
// through the same rule, and core.* is where shared cross-cutting
// exceptions belong (GlobalExceptionHandler already lives here) rather
// than a feature module other modules would have to depend on.
public class InvalidFileTypeException extends RuntimeException {
    public InvalidFileTypeException(String message) {
        super(message);
    }
}
