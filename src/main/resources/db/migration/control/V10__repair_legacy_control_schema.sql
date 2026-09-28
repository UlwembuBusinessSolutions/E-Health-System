-- Some existing development databases recorded V3–V5 as applied while the
-- corresponding DDL was absent. Do not edit those historical migrations: a
-- new, idempotent migration lets both the affected databases and fresh
-- installations converge on the same control-schema contract.
ALTER TABLE control.organizations
    ADD COLUMN IF NOT EXISTS sector VARCHAR(20) NOT NULL DEFAULT 'PRIVATE';

CREATE TABLE IF NOT EXISTS control.module_entitlements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES control.organizations(id),
    module_code VARCHAR(10) NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT false,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (organization_id, module_code)
);

ALTER TABLE control.platform_audit_log
    ADD COLUMN IF NOT EXISTS detail VARCHAR(500);
