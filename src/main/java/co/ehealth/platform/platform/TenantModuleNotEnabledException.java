package co.ehealth.platform.platform;

import co.ehealth.platform.core.tenant.ModuleCode;

// BR-SADM-060's second acceptance criterion: a clinic can never be MORE
// entitled than its own tenant. Thrown before any facility-level row is
// touched — same "check before writing" discipline as FoundationModuleException.
// Deliberately distinct from that exception: this is "the tenant hasn't
// unlocked this yet," not "this module can never be scoped down" — the
// two are opposite failure modes and a caller needs the message to say
// which one occurred.
public class TenantModuleNotEnabledException extends RuntimeException {
    public TenantModuleNotEnabledException(ModuleCode moduleCode) {
        super(moduleCode + " isn't enabled for this organization yet — enable it at the tenant level first, "
                + "then it can be switched on for an individual clinic.");
    }
}