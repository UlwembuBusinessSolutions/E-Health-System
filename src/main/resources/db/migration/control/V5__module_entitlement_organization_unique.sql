-- SQL NULL values do not compare equal in a standard UNIQUE constraint. This
-- partial index makes the organisation-level (clinic_id IS NULL) entitlement
-- unique, preventing duplicate toggle rows under concurrent requests.
CREATE UNIQUE INDEX IF NOT EXISTS module_entitlements_organization_module_unique
    ON control.module_entitlements (tenant_id, module_code)
    WHERE clinic_id IS NULL;
