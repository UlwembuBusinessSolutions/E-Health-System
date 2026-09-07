-- SADM-US-010: switch a module on/off per tenant. No row for a
-- (organization, module_code) pair means "not explicitly toggled" —
-- application code (ModuleCode.isFoundation()) treats Foundation modules as
-- always enabled regardless, and treats any other absent row as disabled,
-- so this table only ever needs to hold the modules a tenant actually has
-- an opinion about.
CREATE TABLE control.module_entitlements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES control.organizations(id),
    module_code VARCHAR(10) NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT false,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (organization_id, module_code)
);
