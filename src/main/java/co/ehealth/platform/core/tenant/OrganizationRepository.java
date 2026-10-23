package co.ehealth.platform.core.tenant;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

// Public, not package-private — OrganizationProvisioningService (platform/
// package) needs to write Organization rows, not just read them the way
// OrganizationLookupServiceImpl does. Both go through this same repository;
// no reason to fork it in two.
//
// JpaSpecificationExecutor — listOrganizations()'s search/status-filter/sort
// needs a dynamically-composed query (any combination of "has a search
// term," "has a status filter," both, or neither), which doesn't fit a
// fixed derived-query method name the way findBySlugAndStatus below does.
public interface OrganizationRepository extends JpaRepository<Organization, UUID>,
        JpaSpecificationExecutor<Organization> {
    Optional<Organization> findBySlugAndStatus(String slug, OrganizationStatus status);

    // TenantFilter's own lookup, regardless of status — it needs to tell
    // "no such tenant" apart from "this tenant exists but is suspended" to
    // give the latter a clear message (SADM-US-003's own acceptance
    // criteria), which findBySlugAndStatus(slug, ACTIVE) can't do: a
    // suspended tenant and a nonexistent one both come back empty from
    // that one.
    Optional<Organization> findBySlug(String slug);

    boolean existsBySlug(String slug);

    // OrganizationBrandingService's lookup key: a tenant-authenticated
    // request only ever has TenantContext.getCurrentTenant() (the schema
    // name) to identify "which org is this," not the slug or id.
    Optional<Organization> findBySchemaName(String schemaName);

    // TenantCodeGenerator's own collision check at provisioning time.
    boolean existsByTenantCode(String tenantCode);

    // PatientMigrationService's destination-picker read — every other
    // ACTIVE organization a tenant could migrate a patient to, excluding
    // its own (a tenant can't migrate a patient to itself). Deliberately
    // narrow, unlike listOrganizations()'s own free-text search: this is
    // reachable by ordinary tenant staff, not just platform operators, so
    // it never takes a query string or returns anything beyond what the
    // caller passes here as filters.
    List<Organization> findByStatusAndIdNot(OrganizationStatus status, UUID excludedId);
}
