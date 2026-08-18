package co.ehealth.platform.core.tenant;

import jakarta.servlet.FilterChain;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class ModuleEntitlementFilterTest {

    private final ModuleEntitlementCache entitlementCache = mock(ModuleEntitlementCache.class);
    private final ModuleEntitlementFilter filter = new ModuleEntitlementFilter(entitlementCache);

    @AfterEach
    void clearTenantContext() {
        TenantContext.clear();
    }

    @Test
    void disabledPatientModule_returnsForbiddenWithoutCallingTheEndpoint() throws Exception {
        TenantContext.setCurrentTenant("acme");
        when(entitlementCache.isEnabled("acme", ModuleCode.PREG)).thenReturn(false);
        FilterChain chain = mock(FilterChain.class);
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter.doFilter(new MockHttpServletRequest("GET", "/api/v1/patients/123"), response, chain);

        assertThat(response.getStatus()).isEqualTo(403);
        assertThat(response.getContentAsString()).contains("PREG is not enabled for this organization");
        verify(entitlementCache).isEnabled("acme", ModuleCode.PREG);
    }

    @Test
    void enabledPatientModule_allowsTheEndpointToHandleTheRequest() throws Exception {
        TenantContext.setCurrentTenant("acme");
        when(entitlementCache.isEnabled("acme", ModuleCode.PREG)).thenReturn(true);
        FilterChain chain = mock(FilterChain.class);
        MockHttpServletResponse response = new MockHttpServletResponse();
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/v1/patients");

        filter.doFilter(request, response, chain);

        verify(chain).doFilter(request, response);
    }
}
