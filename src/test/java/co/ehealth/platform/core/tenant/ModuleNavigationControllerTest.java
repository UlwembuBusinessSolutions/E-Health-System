package co.ehealth.platform.core.tenant;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.AuthorityUtils;

import java.util.List;
import java.util.Map;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class ModuleNavigationControllerTest {

    private final ModuleEntitlementCache cache = mock(ModuleEntitlementCache.class);
    private final ModuleNavigationController controller = new ModuleNavigationController(cache);

    @AfterEach
    void clearTenant() {
        TenantContext.clear();
    }

    @Test
    void enabledModule_isReturnedOnlyWhenTheRoleIsPermitted() {
        TenantContext.setCurrentTenant("acme");
        when(cache.enabledModules("acme")).thenReturn(Set.of(ModuleCode.PREG, ModuleCode.SADM));
        var doctor = new UsernamePasswordAuthenticationToken("user", null,
                AuthorityUtils.createAuthorityList("ROLE_Doctor"));

        Map<String, Object> response = controller.navigation(doctor);

        @SuppressWarnings("unchecked")
        List<ModuleNavigationController.NavigationItem> items =
                (List<ModuleNavigationController.NavigationItem>) response.get("items");
        assertThat(items).extracting(ModuleNavigationController.NavigationItem::module)
                .containsExactly(ModuleCode.PREG);
    }

    @Test
    void disabledModule_isNotReturnedInNavigation() {
        TenantContext.setCurrentTenant("acme");
        when(cache.enabledModules("acme")).thenReturn(Set.of(ModuleCode.SADM));
        var doctor = new UsernamePasswordAuthenticationToken("user", null,
                AuthorityUtils.createAuthorityList("ROLE_Doctor"));

        Map<String, Object> response = controller.navigation(doctor);

        assertThat((List<?>) response.get("items")).isEmpty();
    }
}
