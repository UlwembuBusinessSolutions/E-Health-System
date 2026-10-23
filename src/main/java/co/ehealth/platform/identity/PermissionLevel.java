package co.ehealth.platform.identity;

// Two tiers, not full CRUD — no module in this codebase distinguishes
// finer than read-vs-write today. MANAGE is a superset of VIEW at
// evaluation time (PermissionService.hasAccess()), not a separately
// granted permission — a role with MANAGE on a module was never also
// seeded VIEW for the same module (see V12__role_permissions.sql's own
// why-note).
public enum PermissionLevel {
    VIEW,
    MANAGE
}
