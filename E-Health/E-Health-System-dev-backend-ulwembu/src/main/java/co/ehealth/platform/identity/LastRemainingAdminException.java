package co.ehealth.platform.identity;

// The safety check in StaffService.revokeOrgAdminRole(): removing the last
// ORG_ADMIN would leave the organization with nobody able to create staff,
// upload a logo, or add another admin back — every one of those endpoints
// requires ORG_ADMIN. Same "conflicts with current state" shape as
// OrganizationSuspendedException, just discovered on the identity side.
public class LastRemainingAdminException extends RuntimeException {
    public LastRemainingAdminException(String message) {
        super(message);
    }
}
