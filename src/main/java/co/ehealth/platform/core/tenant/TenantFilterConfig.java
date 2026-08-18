package co.ehealth.platform.core.tenant;

import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.Ordered;

@Configuration
public class TenantFilterConfig {

    @Bean
    public FilterRegistrationBean<TenantFilter> tenantFilterRegistration(
            OrganizationLookupService organizationLookupService) {
        FilterRegistrationBean<TenantFilter> registration =
                new FilterRegistrationBean<>(new TenantFilter(organizationLookupService));
        registration.setOrder(Ordered.HIGHEST_PRECEDENCE); // ahead of Spring Security's chain (order -100)
        registration.addUrlPatterns("/*");
        return registration;
    }

    @Bean
    public FilterRegistrationBean<ModuleEntitlementFilter> moduleEntitlementFilterRegistration(
            ModuleEntitlementCache entitlementCache) {
        FilterRegistrationBean<ModuleEntitlementFilter> registration =
                new FilterRegistrationBean<>(new ModuleEntitlementFilter(entitlementCache));
        // TenantFilter establishes TenantContext first; entitlement checks must
        // run immediately after it and before Spring Security's filter chain.
        registration.setOrder(Ordered.HIGHEST_PRECEDENCE + 1);
        registration.addUrlPatterns("/*");
        return registration;
    }
}
