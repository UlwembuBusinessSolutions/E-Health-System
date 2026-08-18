CREATE TABLE control.module_entitlements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES control.organizations(id),
    clinic_id UUID, -- always NULL today, no Clinic entity exists yet
    module_code VARCHAR(20) NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT true,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, clinic_id, module_code)
);

CREATE INDEX module_entitlements_tenant ON control.module_entitlements(tenant_id);