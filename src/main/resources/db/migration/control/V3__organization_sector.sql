-- SADM-US-002: classify a tenant as Public, Private or Occupational.
-- DEFAULT is a backfill safety net for any row created before this column
-- existed, not a real product default — every create-organization request
-- from here on is required to send one explicitly (see
-- PlatformController.ProvisionOrganizationRequest's @NotNull).
ALTER TABLE control.organizations
    ADD COLUMN sector VARCHAR(20) NOT NULL DEFAULT 'PRIVATE';
