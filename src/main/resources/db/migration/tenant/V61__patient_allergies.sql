-- Patient Allergy Management story: a patient-level allergy record, separate from the per-consultation
-- allergy fields, so an allergy captured once is visible in every consultation, first-visit assessment
-- and prescribing session for that patient.

-- 1. The patient's overall allergy status. UNKNOWN ("never asked") is deliberately distinct from
--    NONE_KNOWN ("asked, patient reports none"); KNOWN is derived from having active allergy rows.
--    One row per patient, created the first time a status or an allergy is recorded.
CREATE TABLE patient_allergy_profiles (
    patient_id         UUID PRIMARY KEY REFERENCES patients (id),
    status             VARCHAR(20) NOT NULL DEFAULT 'UNKNOWN',
    updated_by_user_id UUID,
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_patient_allergy_profile_status CHECK (status IN ('UNKNOWN', 'NONE_KNOWN', 'KNOWN'))
);

-- 2. The allergies themselves. Never deleted: a wrong or resolved entry is marked INACTIVE with a reason,
--    so the clinical history stays auditable.
CREATE TABLE patient_allergies (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id             UUID         NOT NULL REFERENCES patients (id),
    allergy_code           VARCHAR(20),
    allergy_name           VARCHAR(200) NOT NULL,
    allergen_type          VARCHAR(20)  NOT NULL,
    reaction               VARCHAR(500) NOT NULL,
    severity               VARCHAR(20)  NOT NULL,
    date_identified        DATE         NOT NULL,
    clinical_notes         TEXT,
    status                 VARCHAR(20)  NOT NULL DEFAULT 'ACTIVE',
    inactive_reason        VARCHAR(500),
    inactivated_at         TIMESTAMPTZ,
    inactivated_by_user_id UUID,
    created_by_user_id     UUID,
    created_at             TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_by_user_id     UUID,
    updated_at             TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT chk_patient_allergy_type     CHECK (allergen_type IN ('MEDICATION', 'FOOD', 'ENVIRONMENTAL', 'OTHER')),
    CONSTRAINT chk_patient_allergy_severity CHECK (severity IN ('MILD', 'MODERATE', 'SEVERE', 'LIFE_THREATENING')),
    CONSTRAINT chk_patient_allergy_status   CHECK (status IN ('ACTIVE', 'INACTIVE')),
    -- A medication allergy must carry an ATC code: prescribing compares its first 5 characters with the
    -- ATC code of every medicine (same pattern as pharmacy_products.atc_code).
    CONSTRAINT chk_patient_allergy_atc CHECK (
        allergen_type <> 'MEDICATION'
        OR allergy_code ~ '^[A-Z][0-9]{2}[A-Z]{2}([A-Z0-9]{1,2})?$')
);

CREATE INDEX idx_patient_allergies_patient ON patient_allergies (patient_id, status);