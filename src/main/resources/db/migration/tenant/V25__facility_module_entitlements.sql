-- src/main/resources/db/migration/tenant/V19__facility_module_entitlements.sql
-- SADM-US-011 / BR-SADM-060: per-clinic module overrides, scoped to this
-- tenant schema (facility_id is a row in this same schema's `facilities`
-- table). No row for a (facility, module) pair means "inherit whatever the
-- tenant currently has switched on" — application code (FacilityService.
-- listModuleEntitlements()) treats an absent row that way, so this table
-- only ever needs to hold the modules a clinic actually has an opinion
-- about, same "absence is meaningful" pattern as control.module_entitlements.
CREATE TABLE facility_module_entitlements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    facility_id UUID NOT NULL REFERENCES facilities(id),
    module_code VARCHAR(10) NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT false,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (facility_id, module_code)
);