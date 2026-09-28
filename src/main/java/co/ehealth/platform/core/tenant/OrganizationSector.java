package co.ehealth.platform.core.tenant;

// BR-SADM-010 / SADM-US-002 — a tenant's sector, captured once at
// provisioning. Downstream sector-appropriate module defaults
// (SADM-US-002's own acceptance criteria — e.g. Public pre-selecting the
// public-sector module set) depend on the module entitlement system
// (SADM-F03), which doesn't exist in this codebase yet; this enum is the
// piece that's actually built today, ready for that to read once it is.
public enum OrganizationSector {
    PUBLIC,
    PRIVATE,
    OCCUPATIONAL
}
