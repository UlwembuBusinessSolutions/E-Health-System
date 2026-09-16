package co.ehealth.platform.identity;

// Thrown by StaffService.revokeOrgAdminRole() when the target user doesn't
// currently hold ORG_ADMIN — a client input problem (wrong userId, or a
// role already revoked by a concurrent call), not a server error.
public class NotAnOrgAdminException extends RuntimeException {
    public NotAnOrgAdminException(String message) {
        super(message);
    }
}
