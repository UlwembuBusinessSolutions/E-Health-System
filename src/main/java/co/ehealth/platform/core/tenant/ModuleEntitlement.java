package co.ehealth.platform.core.tenant;


import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;



@Entity
@Table(name = "module_entitlements", schema = "control")
public class ModuleEntitlement {

    @Id
    @GeneratedValue
    private UUID id;

    @Column(name = "tenant_id", nullable = false)
    private UUID tenantId;

    @Column(name = "clinic_id")
    private UUID clinicId; // always null until a Clinic entity exists

    @Enumerated(EnumType.STRING)
    @Column(name = "module_code", nullable = false, length = 20)
    private ModuleCode moduleCode;

    @Column(nullable = false)
    private boolean enabled = true;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    // JPA requires a no-arg constructor
    protected ModuleEntitlement() {
    }


    public ModuleEntitlement(UUID tenantId, ModuleCode moduleCode, boolean enabled) {
        this.tenantId = tenantId;
        this.moduleCode = moduleCode;
        this.enabled = enabled;
        this.updatedAt = Instant.now();
    }

    
    public void setEnabled(boolean enabled) {
        this.enabled = enabled;
        this.updatedAt = Instant.now();
    }

    // --- Getters ---
    public UUID getId() {
        return id;
    }

    public UUID getTenantId() {
        return tenantId;
    }

    public UUID getClinicId() {
        return clinicId;
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
