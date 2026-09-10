package co.ehealth.platform.identity;

import co.ehealth.platform.platform.SsoProviderType;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface ExternalIdentityRepository extends JpaRepository<ExternalIdentity, UUID> {
    Optional<ExternalIdentity> findByProviderTypeAndIssuerAndSubject(
            SsoProviderType providerType, String issuer, String subject);
}
