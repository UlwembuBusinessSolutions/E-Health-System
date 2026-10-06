-- Cross-tenant patient migration's MPI-collision fix: patient_mpi_seq
-- (V8__patients.sql, tenant-scoped) starts at 1 independently in every
-- tenant schema, so two tenants can and do issue the same MPI today.
-- Prefixing new MPIs with this per-tenant code (PatientService.register())
-- makes them unique across tenants without needing a shared/coordinated
-- sequence. Derived once here for existing orgs from slug's own initials;
-- TenantCodeGenerator.java is the ongoing source for every org provisioned
-- after this migration runs.
ALTER TABLE control.organizations ADD COLUMN tenant_code VARCHAR(10);

-- Best-effort backfill: first letter of each '-'/'_'-separated slug segment,
-- uppercased (e.g. "demo-clinic" -> "DC"). Unlike TenantCodeGenerator's own
-- collision-retry loop, this has no fallback for two existing orgs whose
-- slugs happen to collide on initials — acceptable today since realistically
-- one org is seeded before this feature exists; revisit before running this
-- against a database with many real tenants.
UPDATE control.organizations
SET tenant_code = (
    SELECT string_agg(upper(left(part, 1)), '')
    FROM unnest(regexp_split_to_array(slug, '[-_]')) AS part
    WHERE part <> ''
)
WHERE tenant_code IS NULL;

ALTER TABLE control.organizations ALTER COLUMN tenant_code SET NOT NULL;
ALTER TABLE control.organizations ADD CONSTRAINT uq_organizations_tenant_code UNIQUE (tenant_code);
