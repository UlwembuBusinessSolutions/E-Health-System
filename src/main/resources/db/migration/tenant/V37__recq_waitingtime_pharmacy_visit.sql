-- RECQ waiting-time journey: preserve the original registration journey when
-- QueueService creates a new Visit at the destination pharmacy facility.
ALTER TABLE waiting_time_log
    ADD COLUMN pharmacy_visit_id UUID;

CREATE UNIQUE INDEX uq_waiting_time_log_pharmacy_visit
    ON waiting_time_log(pharmacy_visit_id)
    WHERE pharmacy_visit_id IS NOT NULL;
