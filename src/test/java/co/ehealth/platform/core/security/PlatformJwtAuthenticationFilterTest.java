package co.ehealth.platform.core.security;

import co.ehealth.platform.platform.PlatformOperatorRepository;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

class PlatformJwtAuthenticationFilterTest {

    @Test
    void appliesPlatformAuthenticationToTheTenantRegister() {
        TestFilter filter = new TestFilter();

        assertThat(filter.shouldFilter("/api/v1/tenants")).isTrue();
        assertThat(filter.shouldFilter("/api/v1/tenants?page=1")).isTrue();
        assertThat(filter.shouldFilter("/platform/auth/login")).isFalse();
    }

    private static class TestFilter extends PlatformJwtAuthenticationFilter {
        TestFilter() {
            super(mock(PlatformJwtService.class), mock(PlatformOperatorRepository.class));
        }

        boolean shouldFilter(String uri) {
            MockHttpServletRequest request = new MockHttpServletRequest("GET", uri);
            return !shouldNotFilter(request);
        }
    }
}
