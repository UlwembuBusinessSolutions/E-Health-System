package co.ehealth.platform.core.tenant;

import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;
import java.util.Set;

/** The frontend uses this contract to render navigation appropriate to the tenant and user role. */
@RestController
public class ModuleNavigationController {
    private final ModuleEntitlementCache entitlementCache;

    public ModuleNavigationController(ModuleEntitlementCache entitlementCache) {
        this.entitlementCache = entitlementCache;
    }

    @GetMapping("/api/v1/navigation")
    public Map<String, Object> navigation(Authentication authentication) {
        Set<String> roles = authentication.getAuthorities().stream()
                .map(authority -> authority.getAuthority())
                .filter(authority -> authority.startsWith("ROLE_"))
                .map(authority -> authority.substring("ROLE_".length()))
                .collect(java.util.stream.Collectors.toUnmodifiableSet());

        var items = entitlementCache.enabledModules(TenantContext.getCurrentTenant()).stream()
                .filter(moduleCode -> moduleCode.isPermittedFor(roles))
                .sorted(java.util.Comparator.comparing(Enum::name))
                .map(moduleCode -> new NavigationItem(moduleCode, moduleCode.getDisplayName(), moduleCode.getNavigationPath()))
                .toList();
        return Map.of("items", items);
    }

    public record NavigationItem(ModuleCode module, String label, String path) { }
}
