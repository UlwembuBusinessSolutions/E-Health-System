package co.ehealth.platform.core.tenant;

// One entry in the full 20-module picture for an organization — shared
// shape between the platform-operator view (PlatformController, an
// arbitrary org by id) and the tenant self-service view (OrganizationSelfController,
// always the caller's own org). Lives in core.tenant rather than
// platform.platform since it's fundamentally this package's data, not a
// platform-operator-only concern — see ModuleEntitlementQueryService's own
// why-note for the read logic this backs.
public record ModuleEntitlementView(
        ModuleCode code, String displayName, ModuleCode.ModulePhase phase, boolean foundation, boolean enabled) {
}
