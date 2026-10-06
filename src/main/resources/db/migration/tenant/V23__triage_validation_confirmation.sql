-- Preserve evidence when a clinician confirms measurements outside broad
-- technical plausibility ranges. These are data-entry safeguards, not
-- diagnostic or SATS thresholds.
ALTER TABLE triage_assessments
    ADD COLUMN out_of_range_confirmed BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN validation_warnings TEXT;
