package co.ehealth.platform.core.tenant;

import java.util.Optional;

// The contract TenantFilter codes against — kept separate from
// OrganizationRepository so TenantFilter never needs Spring Data JPA query
// method names to change its own behavior.
public interface OrganizationLookupService {
    Optional<Organization> findActiveBySlug(String slug);
}
