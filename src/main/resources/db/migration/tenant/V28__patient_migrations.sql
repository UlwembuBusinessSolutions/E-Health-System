-- PatientMigration.java — one append-only row per patient ever migrated out
-- of this tenant to another. Lives in the ORIGIN tenant's own schema (the
-- tenant retaining the "full ongoing access" view), identifiers only, no
-- demographic snapshot — PatientMigrationService.getDestinationView() reads
-- the live destination record through these ids rather than freezing a copy
-- here. patient_id is UNIQUE: migration is one-way, no re-migration.
--
-- destination_organization_id/destination_facility_id point into
-- control.organizations / another tenant's own facilities table — no FK
-- constraint, since both live outside this schema (a cross-schema FK works
-- technically, same physical database, but every tenant schema is
-- provisioned from this same migration set independently of which other
-- organizations exist yet — same "plain column, not a foreign key" choice
-- Patient.registeredByUserId already makes for a same-schema reference that
-- doesn't need real referential integrity enforced at the database level).
CREATE TABLE patient_migrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL UNIQUE REFERENCES patients(id),
    destination_organization_id UUID NOT NULL,
    destination_patient_id UUID NOT NULL,
    destination_facility_id UUID NOT NULL,
    reason TEXT NOT NULL,
    migrated_by_user_id UUID,
    migrated_at TIMESTAMPTZ NOT NULL
);
