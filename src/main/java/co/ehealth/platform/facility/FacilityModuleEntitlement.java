package co.ehealth.platform.facility;

import co.ehealth.platform.core.tenant.ModuleCode;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

// SADM-US-011 / BR-SADM-060 — a per-clinic override of a tenant's own
// module entitlement. Lives in the tenant schema (facilities.id is a
// tenant-schema row, unlike control.module_entitlements which is keyed by
// organization_id in the control schema) — no organizationId column here
// at all, same reasoning Facility itself has none: which tenant a facility
// belongs to is implicit in which schema this row lives in.
//
// A row here only ever means "this clinic's own opinion, distinct from
// its tenant's" — absence means "inherit whatever the tenant currently
// has switched on" (FacilityModuleEntitlementQueryService's own why-note),
// not "disabled." Foundation modules (SADM/AUDT/IAM) never get a row here,
// same as they never get one in module_entitlements.
@Entity
@Table(name = "facility_module_entitlements")
public class FacilityModuleEntitlement {

    @Id
    @GeneratedValue
    private UUID id;

    @Column(name = "facility_id", nullable = false)
    private UUID facilityId;

    @Enumerated(EnumType.STRING)
    @Column(name = "module_code", nullable = false, length = 10)
    private ModuleCode moduleCode;

    @Column(nullable = false)
    private boolean enabled;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected FacilityModuleEntitlement() {
    }

    public FacilityModuleEntitlement(UUID facilityId, ModuleCode moduleCode, boolean enabled) {
        this.facilityId = facilityId;
        this.moduleCode = moduleCode;
        this.enabled = enabled;
        this.updatedAt = Instant.now();
    }

    public void setEnabled(boolean enabled) {
        this.enabled = enabled;
        this.updatedAt = Instant.now();
    }

    public UUID getId() {
        return id;
    }

    public UUID getFacilityId() {
        return facilityId;
    }

    public ModuleCode getModuleCode() {
        return moduleCode;
    }

    public boolean isEnabled() {
        return enabled;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }
}