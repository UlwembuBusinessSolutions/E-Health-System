package co.ehealth.platform.core.tenant;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ModuleEntitlementRepository extends JpaRepository<ModuleEntitlement, UUID> {
    List<ModuleEntitlement> findByOrganizationId(UUID organizationId);

    Optional<ModuleEntitlement> findByOrganizationIdAndModuleCode(UUID organizationId, ModuleCode moduleCode);

    // One grouped query rather than one findByOrganizationId() per row on
    // the organizations list (SADM-US-010's own "Modules" column) — an org
    // roster large enough to paginate is exactly where N+1 here would start
    // to hurt. An org with zero enabled non-Foundation modules is simply
    // absent from the result, same as any other GROUP BY with nothing to
    // group — OrganizationProvisioningService.countEnabledModules() is
    // where that gets turned back into an explicit zero.
    @Query("SELECT me.organizationId, COUNT(me) FROM ModuleEntitlement me "
            + "WHERE me.organizationId IN :organizationIds AND me.enabled = true "
            + "GROUP BY me.organizationId")
    List<Object[]> countEnabledByOrganizationIdIn(@Param("organizationIds") Collection<UUID> organizationIds);
}
