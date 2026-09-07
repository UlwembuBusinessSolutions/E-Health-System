package co.ehealth.platform.identity;

import java.util.Set;

// Single source of truth for role names this system reserves for platform
// operators — never legitimately a row in any tenant's roles table (see
// StaffService.requireAssignableRole()'s own why-note). Shared between
// RoleController (keeps it out of the assignable-roles dropdown) and
// StaffService (rejects it if a crafted request bypasses that dropdown),
// so the two enforcement points can't silently drift apart.
public final class ReservedRoleNames {

    public static final Set<String> NAMES =
            Set.of("SUPER_ADMIN", "SUPER ADMIN", "PLATFORM_OPERATOR", "PLATFORM OPERATOR");

    private ReservedRoleNames() {
    }

    public static boolean isReserved(String roleName) {
        return NAMES.contains(roleName.toUpperCase());
    }
}
