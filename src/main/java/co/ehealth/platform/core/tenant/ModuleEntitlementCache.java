package co.ehealth.platform.core.tenant;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Cache of module entitlements per tenant.
 *
 * <p>
 * Refreshed every 30 seconds to avoid hitting the database
 * on every request. Provides a quick lookup for whether a
 * given module is enabled for a tenant.
 * </p>
 */
@Component
public class ModuleEntitlementCache {

    private final ModuleEntitlementRepository repository;
    private final OrganizationRepository organizationRepository;

    // Requests identify a tenant by schema name, while entitlements are keyed by
    // organization UUID. Keep both sides of that mapping in the cache.
    private volatile Map<UUID, Set<ModuleCode>> enabledByTenant = Map.of();
    private volatile Map<String, UUID> tenantIdBySchema = Map.of();

    public ModuleEntitlementCache(ModuleEntitlementRepository repository,
                                  OrganizationRepository organizationRepository) {
        this.repository = repository;
        this.organizationRepository = organizationRepository;
    }

    /**
     * Refreshes the cache every 30 seconds.
     *
     * Half the NFR's budget is used as margin for the refresh itself
     * taking non-zero time, leaving headroom rather than cutting it exactly.
     */
    @Scheduled(fixedRate = 30_000, initialDelay = 30_000)
    public void refresh() {
        enabledByTenant = repository.findAll().stream()
                .filter(ModuleEntitlement::isEnabled)
                .collect(Collectors.groupingBy(
                        ModuleEntitlement::getTenantId,
                        Collectors.mapping(ModuleEntitlement::getModuleCode, Collectors.toSet())));
        tenantIdBySchema = organizationRepository.findAll().stream()
                .collect(Collectors.toUnmodifiableMap(Organization::getSchemaName, Organization::getId));
    }

    public boolean isEnabled(String schemaName, ModuleCode moduleCode) {
        if (moduleCode.isFoundation()) {
            return true;
        }
        UUID tenantId = tenantIdBySchema.get(schemaName);
        return tenantId != null && enabledByTenant.getOrDefault(tenantId, Set.of()).contains(moduleCode);
    }

    /** Returns enabled tenant modules plus the foundation modules that are always on. */
    public Set<ModuleCode> enabledModules(String schemaName) {
        UUID tenantId = tenantIdBySchema.get(schemaName);
        Set<ModuleCode> enabled = tenantId == null
                ? Set.of()
                : enabledByTenant.getOrDefault(tenantId, Set.of());
        Set<ModuleCode> result = new java.util.HashSet<>(enabled);
        for (ModuleCode moduleCode : ModuleCode.values()) {
            if (moduleCode.isFoundation()) {
                result.add(moduleCode);
            }
        }
        return Set.copyOf(result);
    }

    /** Applies a changed entitlement immediately; the scheduled refresh remains a safety net. */
    public synchronized void invalidate(UUID tenantId) {
        Set<ModuleCode> enabled = repository.findByTenantId(tenantId).stream()
                .filter(ModuleEntitlement::isEnabled)
                .map(ModuleEntitlement::getModuleCode)
                .collect(Collectors.toUnmodifiableSet());
        Map<UUID, Set<ModuleCode>> updated = new java.util.HashMap<>(enabledByTenant);
        updated.put(tenantId, enabled);
        enabledByTenant = Map.copyOf(updated);
    }
}

