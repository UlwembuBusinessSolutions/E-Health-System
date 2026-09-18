package co.ehealth.platform.core.clinic;

// lihle | 2026-09-09 | Added assigned-clinic context and access checks to prevent access outside a user's clinic scope.

public class ClinicAccessDeniedException extends RuntimeException {
    public ClinicAccessDeniedException(String message) { super(message); }
}
