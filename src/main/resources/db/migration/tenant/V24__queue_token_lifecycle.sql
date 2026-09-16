ALTER TABLE queue_tokens
    ADD COLUMN version BIGINT NOT NULL DEFAULT 0,
    ADD COLUMN completed_at TIMESTAMPTZ,
    ADD COLUMN stopped_at TIMESTAMPTZ,
    ADD COLUMN cancelled_at TIMESTAMPTZ,
    ADD COLUMN cancellation_reason VARCHAR(40),
    ADD CONSTRAINT queue_token_status CHECK (status IN ('ISSUED', 'CALLED', 'IN_SERVICE', 'STOPPED', 'COMPLETED', 'CANCELLED')),
    ADD CONSTRAINT queue_token_completion CHECK (status <> 'COMPLETED' OR completed_at IS NOT NULL),
    ADD CONSTRAINT queue_token_cancellation CHECK (status <> 'CANCELLED' OR (cancelled_at IS NOT NULL AND cancellation_reason IS NOT NULL));
