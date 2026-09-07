package co.ehealth.platform.core.tenant;

import org.springframework.stereotype.Service;

import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

// The one place that turns "some rows in module_entitlements" into "the
// full 20-module picture" — a Foundation module reads as enabled
// unconditionally (never gets a row at all), and any other module with no
// row yet reads as disabled rather than being omitted. Both
// OrganizationProvisioningService.listModuleEntitlements() (a platform
// operator, an arbitrary org by id) and OrganizationSelfController (a
// tenant's own staff, always their own org) delegate here rather than each
// keeping their own copy of this logic — the two started as one method
// (SADM-US-010, platform-side only) and would have silently diverged the
// first time either read path changed without the other.
@Service
public class ModuleEntitlementQueryService {

    private final ModuleEntitlementRepository moduleEntitlementRepository;

    public ModuleEntitlementQueryService(ModuleEntitlementRepository moduleEntitlementRepository) {
        this.moduleEntitlementRepository = moduleEntitlementRepository;
    }

    public List<ModuleEntitlementView> listForOrganization(UUID organizationId) {
        Map<ModuleCode, Boolean> enabledByCode = moduleEntitlementRepository.findByOrganizationId(organizationId)
                .stream().collect(Collectors.toMap(ModuleEntitlement::getModuleCode, ModuleEntitlement::isEnabled));
        return Arrays.stream(ModuleCode.values())
                .map(code -> new ModuleEntitlementView(code, code.getDisplayName(), code.getPhase(),
                        code.isFoundation(), code.isFoundation() || enabledByCode.getOrDefault(code, false)))
                .toList();
    }
}
