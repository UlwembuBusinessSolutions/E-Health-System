-- Free-text notes on an appointment (e.g. "chronic follow-up, bring repeat
-- script") — reception or the booking clinician's own context for the visit,
-- visible on the diary. Nullable: every appointment before this migration,
-- and any new one, may simply have none. No length CHECK here; the
-- application layer enforces the 1000-character cap (AppointmentController's
-- own validation), same division of labour as cancel_reason's 500-char cap
-- in V38.
ALTER TABLE appointments ADD COLUMN notes VARCHAR(1000);
