package co.ehealth.platform.core.tenant;

import java.util.Set;

/** Module catalogue: entitlement, navigation metadata, and role visibility live together. */
public enum ModuleCode {
    SADM(true, "System Administration", "/admin", Set.of("ORG_ADMIN")),
    AUDT(true, "Audit & Compliance", "/audit", Set.of("ORG_ADMIN")),
    IAM(true, "Identity & Access Management", "/admin/staff", Set.of("ORG_ADMIN")),
    PREG(false, "Patient Registry", "/patients",
            Set.of("ORG_ADMIN", "Doctor", "Professional Nurse", "Clinician"));

    private final boolean foundation;
    private final String displayName;
    private final String navigationPath;
    private final Set<String> permittedRoles;

    ModuleCode(boolean foundation, String displayName, String navigationPath, Set<String> permittedRoles) {
        this.foundation = foundation;
        this.displayName = displayName;
        this.navigationPath = navigationPath;
        this.permittedRoles = Set.copyOf(permittedRoles);
    }

    public boolean isFoundation() { return foundation; }
    public String getDisplayName() { return displayName; }
    public String getNavigationPath() { return navigationPath; }

    public boolean isPermittedFor(Set<String> roles) {
        return roles.stream().anyMatch(permittedRoles::contains);
    }
}
