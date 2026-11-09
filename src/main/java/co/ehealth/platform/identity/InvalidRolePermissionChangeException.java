package co.ehealth.platform.identity;

// Unknown permission code, blank entry, or an attempt to edit a protected role.
public class InvalidRolePermissionChangeException extends RuntimeException {
    public InvalidRolePermissionChangeException(String message) {
        super(message);
    }
}