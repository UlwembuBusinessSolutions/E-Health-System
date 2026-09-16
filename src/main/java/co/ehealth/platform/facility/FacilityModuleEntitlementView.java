package co.ehealth.platform.facility;

import co.ehealth.platform.core.tenant.ModuleCode;

// The full 20-module picture for one clinic — mirrors
// core.tenant.ModuleEntitlementView's shape, plus the two fields that
// distinguish "this clinic's own state" from "its tenant's": tenantEnabled
// (what the AC's own "blocked unless tenant-level is on" check reads) and
// overridden (whether this clinic has ever explicitly departed from its
// tenant's default — distinct from `enabled`, since a clinic can have an
// explicit row that happens to match the tenant's current value).
public record FacilityModuleEntitlementView(
        ModuleCode code, String displayName, ModuleCode.ModulePhase phase, boolean foundation,
        boolean tenantEnabled, boolean enabled, boolean overridden) {
}