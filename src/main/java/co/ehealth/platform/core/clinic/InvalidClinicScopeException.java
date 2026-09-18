package co.ehealth.platform.core.clinic;

// lihle | 2026-09-09 | Added assigned-clinic context and access checks to prevent access outside a user's clinic scope.

public class InvalidClinicScopeException extends RuntimeException {
    public InvalidClinicScopeException(String message) { super(message); }
}
