-- Normalizes what V20 had to bolt on as wide, nullable "outcome" columns
-- on queue_tokens (missed_at, completed_at, cancelled_at, cancel_reason)
-- by adding a real append-only history: every transition (issue, call,
-- miss, reactivate, complete, cancel, priority change) gets its own row
-- here, so a token that's missed -> reactivated -> missed again doesn't
-- silently lose the record of the first miss the way overwriting a single
-- missed_at column would. queue_tokens' own columns stay as they are — a
-- fast, join-free snapshot of the token's *current* episode, not the
-- source of truth for its full history; this table is that source of
-- truth.
CREATE TABLE queue_token_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    token_id UUID NOT NULL REFERENCES queue_tokens(id),
    event_type VARCHAR(30) NOT NULL,
    from_status VARCHAR(20),
    to_status VARCHAR(20),
    from_priority VARCHAR(20),
    to_priority VARCHAR(20),
    reason_code VARCHAR(40),
    reason_note TEXT,
    performed_by_user_id UUID,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- The only access pattern this needs today: a token's own history in
-- order. No facility-scoped index — nothing queries this across tokens
-- yet, and adding one before there's a real query to serve it would be
-- guessing at a shape that isn't known.
CREATE INDEX idx_queue_token_events_token ON queue_token_events(token_id, occurred_at);
