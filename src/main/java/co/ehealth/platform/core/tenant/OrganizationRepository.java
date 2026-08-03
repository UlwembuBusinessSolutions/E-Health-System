package co.ehealth.platform.core.tenant;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

// Public, not package-private — OrganizationProvisioningService (platform/
// package) needs to write Organization rows, not just read them the way
// OrganizationLookupServiceImpl does. Both go through this same repository;
// no reason to fork it in two.
public interface OrganizationRepository extends JpaRepository<Organization, UUID> {
    Optional<Organization> findBySlugAndStatus(String slug, OrganizationStatus status);

    boolean existsBySlug(String slug);

    // OrganizationBrandingService's lookup key: a tenant-authenticated
    // request only ever has TenantContext.getCurrentTenant() (the schema
    // name) to identify "which org is this," not the slug or id.
    Optional<Organization> findBySchemaName(String schemaName);
}
