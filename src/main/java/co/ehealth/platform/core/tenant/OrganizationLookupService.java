package co.ehealth.platform.core.tenant;

import java.util.Optional;

// The contract TenantFilter codes against — kept separate from
// OrganizationRepository so TenantFilter never needs Spring Data JPA query
// method names to change its own behavior.
public interface OrganizationLookupService {
    Optional<Organization> findActiveBySlug(String slug);

    // Regardless of status — see the why-note on OrganizationRepository.findBySlug()
    // for why TenantFilter needs this distinct from findActiveBySlug() above.
    Optional<Organization> findBySlug(String slug);
}
