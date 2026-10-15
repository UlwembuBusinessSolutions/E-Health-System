package co.ehealth.platform.platform;

// Replaces a generic IllegalArgumentException("Unknown organization") that
// OrganizationProvisioningService threw at four separate call sites —
// uncaught, all four fell through to a bare 500 instead of a clean 404.
// Purpose-built rather than reusing IllegalArgumentException globally: a
// blanket handler for that type would risk mapping an unrelated bug
// elsewhere in the codebase to a misleading 404, the same reasoning behind
// every other narrow exception type in this codebase (DuplicateFieldException,
// AccountLockedException, ...).
public class OrganizationNotFoundException extends RuntimeException {
    public OrganizationNotFoundException() {
        super("Unknown organization");
    }
}
