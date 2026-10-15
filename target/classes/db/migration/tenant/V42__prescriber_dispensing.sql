ALTER TABLE dispensing_records
    ADD COLUMN prescriber_dispensed BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN no_dispenser_on_duty BOOLEAN NOT NULL DEFAULT FALSE;