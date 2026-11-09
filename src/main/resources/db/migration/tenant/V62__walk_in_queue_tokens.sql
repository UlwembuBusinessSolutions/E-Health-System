-- Walk-in queue tickets can be issued before the patient is registered.
-- These visits are queue-only. Clinical workflows require a separate
-- patient-linked visit.
ALTER TABLE visits ALTER COLUMN patient_id DROP NOT NULL;
