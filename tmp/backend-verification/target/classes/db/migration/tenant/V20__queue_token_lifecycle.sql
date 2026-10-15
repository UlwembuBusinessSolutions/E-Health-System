-- RECQ-US-005 + the out-and-back recall flow (queue-appointments-plan.md
-- §3.4/§3.8, queue-system-improvements.md §1/§3): widens queue_tokens
-- beyond ISSUED/CALLED so a token can leave the active queue for good
-- (COMPLETED/CANCELLED) instead of lingering forever, and so a patient who
-- didn't answer a call (MISSED) can be recalled without losing their
-- original priority or place in line. Existing rows are all ISSUED/CALLED
-- already, so no backfill is needed for the new columns — they simply
-- stay NULL until a token actually reaches that state.
ALTER TABLE queue_tokens
    ADD COLUMN missed_at TIMESTAMPTZ,
    ADD COLUMN completed_at TIMESTAMPTZ,
    ADD COLUMN cancelled_at TIMESTAMPTZ,
    ADD COLUMN cancel_reason TEXT,
    ADD COLUMN cancelled_by_user_id UUID;
