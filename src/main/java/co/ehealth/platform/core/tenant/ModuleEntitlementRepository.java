package co.ehealth.platform.core.tenant;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Repository interface for managing ModuleEntitlement entities.
 *
 * - Provides lookup by tenant and module code (clinicId = null until Clinic entity exists).
 * - Supports listing all entitlements for a given tenant.
 *
 * This repository is used by ModuleEntitlementService to enforce
 * foundation module rules and toggle entitlements per tenant.
 */
public interface ModuleEntitlementRepository extends JpaRepository<ModuleEntitlement, UUID> {

    /**
     * Find a module entitlement for a tenant and module code,
     * restricted to tenant-level (clinicId is null).
     *
     * @param tenantId   the tenant identifier
     * @param moduleCode the module code
     * @return Optional entitlement record
     */
    Optional<ModuleEntitlement> findByTenantIdAndModuleCodeAndClinicIdIsNull(UUID tenantId, ModuleCode moduleCode);

    /**
     * Find all module entitlements for a given tenant.
     *
     * @param tenantId the tenant identifier
     * @return list of entitlements
     */
    List<ModuleEntitlement> findByTenantId(UUID tenantId);
}
