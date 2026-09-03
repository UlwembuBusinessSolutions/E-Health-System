package co.ehealth.platform.core.tenant;

import org.hibernate.cfg.AvailableSettings;
import org.springframework.boot.autoconfigure.orm.jpa.HibernatePropertiesCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class TenancyHibernateConfig {

    // Spring Boot doesn't auto-wire custom multi-tenancy beans just by
    // being on the classpath — HibernatePropertiesCustomizer is the
    // documented hook for Hibernate settings application.yml can't express.
    @Bean
    public HibernatePropertiesCustomizer hibernatePropertiesCustomizer(
            TenantConnectionProvider connectionProvider,
            TenantIdentifierResolver identifierResolver) {
        return properties -> {
            properties.put(AvailableSettings.MULTI_TENANT_CONNECTION_PROVIDER, connectionProvider);
            properties.put(AvailableSettings.MULTI_TENANT_IDENTIFIER_RESOLVER, identifierResolver);
        };
    }
}
