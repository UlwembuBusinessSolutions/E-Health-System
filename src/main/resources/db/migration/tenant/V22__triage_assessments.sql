-- RECQ-US-008/009/010 — vitals/triage capture, the missing link between
-- the queue and a doctor's consultation (Docs/vitals-triage-plan.md). Each
-- row is one capture, written once and never edited in place: `status` +
-- `supersedes_assessment_id` carry corrections without destroying the
-- original entry, the same append-only lesson queue_token_events (V21)
-- already applied to the queue side of this system.
CREATE TABLE triage_assessments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    visit_id UUID NOT NULL REFERENCES visits(id),

    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    supersedes_assessment_id UUID REFERENCES triage_assessments(id),
    correction_reason TEXT,

    emergency_sign BOOLEAN NOT NULL DEFAULT FALSE,
    emergency_sign_note TEXT,

    scoring_profile VARCHAR(30) NOT NULL,
    profile_manually_confirmed BOOLEAN NOT NULL DEFAULT FALSE,

    respiratory_rate INT,
    heart_rate INT,
    systolic_bp INT,
    diastolic_bp INT,
    temperature_celsius DOUBLE PRECISION,
    spo2_percent INT,
    oxygen_support VARCHAR(20) NOT NULL DEFAULT 'ROOM_AIR',
    oxygen_device VARCHAR(60),
    oxygen_flow_lpm DOUBLE PRECISION,
    avpu VARCHAR(20),
    mobility VARCHAR(30),
    pain_score INT,
    pain_scale VARCHAR(30),
    presenting_complaint TEXT,

    tews_score INT,
    scoring_version VARCHAR(30) NOT NULL,
    calculated_colour VARCHAR(10) NOT NULL,
    final_colour VARCHAR(10) NOT NULL,
    override_reason TEXT,
    overridden_by_user_id UUID,

    captured_by_user_id UUID NOT NULL,
    observed_at TIMESTAMPTZ NOT NULL,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    idempotency_key VARCHAR(100)
);

-- TriageAssessmentRepository's two real access patterns: a visit's full
-- history in order, and the idempotency check on (visit, key) — a retried
-- capture request with the same key must find the row that already exists
-- rather than inserting a duplicate. Partial (WHERE idempotency_key IS NOT
-- NULL) so most rows, which never repeat a key, don't pay for the index.
CREATE INDEX idx_triage_assessments_visit ON triage_assessments(visit_id, observed_at);
CREATE UNIQUE INDEX idx_triage_assessments_idempotency ON triage_assessments(visit_id, idempotency_key)
    WHERE idempotency_key IS NOT NULL;

-- Discriminators are a genuine one-to-many (an assessment can carry
-- several) — a real child table, not a comma-joined string or a jsonb
-- array, so "which assessments had chest pain" is a normal join, not a
-- text search.
CREATE TABLE triage_assessment_discriminators (
    assessment_id UUID NOT NULL REFERENCES triage_assessments(id),
    discriminator VARCHAR(40) NOT NULL
);

CREATE INDEX idx_triage_assessment_discriminators_assessment
    ON triage_assessment_discriminators(assessment_id);
