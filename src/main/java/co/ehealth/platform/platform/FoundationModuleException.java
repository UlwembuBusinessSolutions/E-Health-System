package co.ehealth.platform.platform;

import co.ehealth.platform.core.tenant.ModuleCode;

// SADM-US-010's third acceptance criterion: SADM/AUDT/IAM can never be
// switched off for any tenant. Thrown before OrganizationProvisioningService.
// toggleModule() ever touches the database — not just on an attempt to
// disable one; a Foundation module already reads as enabled regardless of
// what's in module_entitlements (ModuleCode.isFoundation()), so a request
// to turn one "on" is equally meaningless, not just one to turn it off.
public class FoundationModuleException extends RuntimeException {
    public FoundationModuleException(ModuleCode moduleCode) {
        super(moduleCode + " is a Foundation module and is always on — it can't be toggled.");
    }
}
