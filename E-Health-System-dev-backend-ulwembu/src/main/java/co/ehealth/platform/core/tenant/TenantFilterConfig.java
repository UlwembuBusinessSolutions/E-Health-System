package co.ehealth.platform.core.tenant;

import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.Ordered;
import org.springframework.web.cors.CorsConfigurationSource;

@Configuration
public class TenantFilterConfig {

    // The same CorsConfigurationSource bean SecurityConfig defines — there's
    // only one in the app, Spring wires it here by type. TenantFilter needs
    // it directly (see that class's own why-note) since it runs ahead of
    // Spring Security's filter chain and can't rely on that chain's own
    // CorsFilter to decorate a response TenantFilter writes and returns
    // early on.
    @Bean
    public FilterRegistrationBean<TenantFilter> tenantFilterRegistration(
            OrganizationLookupService organizationLookupService, CorsConfigurationSource corsConfigurationSource) {
        FilterRegistrationBean<TenantFilter> registration = new FilterRegistrationBean<>(
                new TenantFilter(organizationLookupService, corsConfigurationSource));
        registration.setOrder(Ordered.HIGHEST_PRECEDENCE); // ahead of Spring Security's chain (order -100)
        registration.addUrlPatterns("/*");
        return registration;
    }
}
