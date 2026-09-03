package co.ehealth.platform.platform;

import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.Ordered;

import java.time.Clock;

// Registered ahead of everything else — including core.tenant.TenantFilterConfig's
// own TenantFilter, bumped to HIGHEST_PRECEDENCE + 1 for this reason — since
// TenantAccessTracker.reset() has to run before the very first tenant
// switch of the request.
@Configuration
public class CrossTenantAccessFilterConfig {

    @Bean
    public FilterRegistrationBean<CrossTenantAccessFilter> crossTenantAccessFilterRegistration(
            PlatformAuditLogRepository platformAuditLogRepository, Clock clock) {
        FilterRegistrationBean<CrossTenantAccessFilter> registration = new FilterRegistrationBean<>(
                new CrossTenantAccessFilter(platformAuditLogRepository, clock));
        registration.setOrder(Ordered.HIGHEST_PRECEDENCE);
        registration.addUrlPatterns("/*");
        return registration;
    }
}