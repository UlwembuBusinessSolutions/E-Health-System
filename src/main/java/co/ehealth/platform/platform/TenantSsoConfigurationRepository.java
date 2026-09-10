package co.ehealth.platform.platform;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface TenantSsoConfigurationRepository extends JpaRepository<TenantSsoConfiguration, UUID> {
    Optional<TenantSsoConfiguration> findByOrganizationId(UUID organizationId);
}
