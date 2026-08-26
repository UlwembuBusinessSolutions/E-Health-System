package co.ehealth.platform.core.tenant;

// The same 20 module codes as the Planner Backlog CSV's Module/Epic
// columns and the eHealth Prototype's own MODULES array — kept as one
// static enum here rather than a database table since the module catalogue
// itself isn't tenant-editable data, only which of these 20 a given tenant
// has switched on is (ModuleEntitlement).
public enum ModuleCode {
    SADM("Platform Administration & Tenant Lifecycle", ModulePhase.FOUNDATION),
    AUDT("Audit Trail & Compliance", ModulePhase.FOUNDATION),
    IAM("Identity, Authentication & RBAC", ModulePhase.FOUNDATION),

    PREG("Registration & Electronic Patient Record", ModulePhase.MVP0),
    RECQ("Reception, Triage & Queue Management", ModulePhase.MVP0),
    APPT("Appointment & Scheduling", ModulePhase.MVP0),
    PHRM("Pharmacy Dispensing & Stock", ModulePhase.MVP0),
    BIOM("Biometrics & Identity Verification", ModulePhase.MVP0),

    CSAC("Acute & Minor Ailments", ModulePhase.PHASE_2),
    CSCC("Chronic Care & CCMDD", ModulePhase.PHASE_2),
    CSMC("Maternal, Child & SRH", ModulePhase.PHASE_2),
    RPTA("Reporting & Analytics", ModulePhase.PHASE_2),
    MHWA("Mobile Self-Service", ModulePhase.PHASE_2),
    OCCH("Occupational Health", ModulePhase.PHASE_2),

    CASE("Case Management", ModulePhase.PHASE_3),
    ASMT("Digital Assessments", ModulePhase.PHASE_3),
    TELE("Telehealth", ModulePhase.PHASE_3),
    PBIL("Private Billing", ModulePhase.PHASE_3),

    MENV("Environmental Health", ModulePhase.PHASE_4),
    CSOC("Community Programmes", ModulePhase.PHASE_4);

    private final String displayName;
    private final ModulePhase phase;

    ModuleCode(String displayName, ModulePhase phase) {
        this.displayName = displayName;
        this.phase = phase;
    }

    public String getDisplayName() {
        return displayName;
    }

    public ModulePhase getPhase() {
        return phase;
    }

    // SADM/AUDT/IAM — always on for every tenant, never toggled off. Every
    // module-entitlement write path (ModuleEntitlementController's why-note,
    // OrganizationProvisioningService.toggleModule()) rejects a request
    // targeting one of these before it ever reaches the database, per
    // SADM-US-010's own acceptance criteria.
    public boolean isFoundation() {
        return phase == ModulePhase.FOUNDATION;
    }

    public enum ModulePhase {
        FOUNDATION, MVP0, PHASE_2, PHASE_3, PHASE_4
    }
}
