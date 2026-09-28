package co.ehealth.platform.core.tenant;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

// SADM-US-010. One row per (organization, non-Foundation module) that's
// ever been explicitly toggled — organizationId is a plain UUID, not a
// @ManyToOne, same style as PlatformAuditLog.organizationId; this table
// lives in the control schema like Organization itself, no tenant-schema
// switching involved. Foundation modules (SADM/AUDT/IAM) deliberately never
// get a row here at all — ModuleCode.isFoundation() is checked before any
// write, and OrganizationProvisioningService.listModuleEntitlements()
// treats a Foundation module as enabled regardless of what this table says,
// so there's nothing for a row to mean for one.
@Entity
@Table(name = "module_entitlements", schema = "control")
public class ModuleEntitlement {

    @Id
    @GeneratedValue
    private UUID id;

    @Column(name = "organization_id", nullable = false)
    private UUID organizationId;

    @Enumerated(EnumType.STRING)
    @Column(name = "module_code", nullable = false, length = 10)
    private ModuleCode moduleCode;

    @Column(nullable = false)
    private boolean enabled;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected ModuleEntitlement() {
    }

    public ModuleEntitlement(UUID organizationId, ModuleCode moduleCode, boolean enabled) {
        this.organizationId = organizationId;
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

    public UUID getOrganizationId() {
        return organizationId;
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
