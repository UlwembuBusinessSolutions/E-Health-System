-- The "Consultation MVP" slice of Docs/vitals-to-consultation-pharmacy-
-- closure-brainstorm.md §5/§13.5/§13.7 — a real diagnosis/notes/treatment-
-- plan record linked to the Visit, draft -> signed, corrected only through
-- a linked amendment (never edited in place once signed) — the same
-- append-only lesson triage_assessments (V22) already applied to vitals,
-- applied here to the next step in the same encounter. Deliberately does
-- NOT duplicate presenting complaint or vital signs: those already live on
-- triage_assessments for this visit_id and are read from there, not
-- re-captured here.
--
-- No visit_service_tasks, no visit-level open/closed status, no completion
-- coordinator — explicitly out of scope for this slice (design doc §11);
-- this table only records a consultation's clinical content and outcome
-- choice, not who has claimed it or whether the visit as a whole is done.
CREATE TABLE consultations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    visit_id UUID NOT NULL REFERENCES visits(id),

    -- DRAFT while being written; SIGNED once locked; SUPERSEDED once a
    -- later amendment replaces it; ENTERED_IN_ERROR for a pure mistake with
    -- nothing to replace it — the same four-way split TriageAssessmentStatus
    -- established, with DRAFT added because (unlike a vitals reading) a
    -- consultation has a real multi-step authoring phase before it becomes
    -- a fact of record.
    status VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    supersedes_consultation_id UUID REFERENCES consultations(id),
    -- Doubles as the entered-in-error reason and the amendment reason, the
    -- same dual-purpose role triage_assessments.correction_reason plays.
    amendment_reason TEXT,

    author_user_id UUID NOT NULL,
    signed_by_user_id UUID,
    signed_at TIMESTAMPTZ,

    relevant_history TEXT,
    current_medications TEXT,
    -- UNKNOWN vs NONE_KNOWN is the mockup's own explicit distinction —
    -- "hasn't been asked" must never default to "asked and confirmed none."
    allergy_status VARCHAR(20) NOT NULL DEFAULT 'UNKNOWN',
    allergy_detail TEXT,
    examination_notes TEXT,
    investigations_notes TEXT,
    treatment_plan TEXT,

    -- Null until signed; required at sign time (ConsultationService.sign()).
    outcome VARCHAR(30),
    outcome_notes TEXT,

    -- The only clinical table in this codebase where a row is genuinely
    -- mutated in place after insert (while still DRAFT) — every earlier one
    -- (triage_assessments, prescriptions) is write-once. updated_at exists
    -- because of that, not by copied convention.
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ConsultationService.getCurrent()'s two lookups (latest DRAFT, latest
-- SIGNED) and getHistory()'s full-timeline read.
CREATE INDEX idx_consultations_visit ON consultations(visit_id, created_at);
CREATE INDEX idx_consultations_visit_status ON consultations(visit_id, status);

-- A genuine one-to-many with its own per-row identity (text, primary flag,
-- certainty), individually addable/removable — a real child table, not an
-- @ElementCollection.
CREATE TABLE consultation_diagnoses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    consultation_id UUID NOT NULL REFERENCES consultations(id),
    diagnosis_text TEXT NOT NULL,
    is_primary BOOLEAN NOT NULL DEFAULT FALSE,
    certainty VARCHAR(20) NOT NULL DEFAULT 'PROVISIONAL',
    sort_order INT NOT NULL DEFAULT 0,

    -- Forward-compat room for a real ICD-10/SNOMED catalogue once one is
    -- configured for a deployment (design doc §13.5) — nullable and unused
    -- by this slice, included now rather than retrofitted onto historical
    -- rows later.
    coding_system VARCHAR(30),
    catalogue_version VARCHAR(30),
    code VARCHAR(30),
    display_text TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_consultation_diagnoses_consultation
    ON consultation_diagnoses(consultation_id, sort_order);

-- At most one primary diagnosis per consultation, enforced at the database
-- too — ConsultationService.addDiagnosis() already auto-clears any existing
-- primary before setting a new one; this is the defense-in-depth backstop.
CREATE UNIQUE INDEX idx_consultation_diagnoses_one_primary
    ON consultation_diagnoses(consultation_id) WHERE is_primary = TRUE;
