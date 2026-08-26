package co.ehealth.platform.identity;

// SADM-US security control: a tenant-context request tried to assign a
// role this system reserves for platform operators (PLATFORM_OPERATOR/
// "Super Admin" never exists as a row in any tenant's roles table — see
// StaffService.createStaff()'s own why-note) or a roleId that doesn't
// resolve to a real role in this tenant at all. 403, not 409/404: the
// caller is authenticated and otherwise permitted to create staff, they
// just aren't allowed to hand out this specific role.
public class RoleEscalationException extends RuntimeException {
    public RoleEscalationException(String message) {
        super(message);
    }
}
