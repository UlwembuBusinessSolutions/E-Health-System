CREATE TABLE art_initiation_clinician_details (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    visit_id UUID NOT NULL UNIQUE REFERENCES visits(id),
    signature_data_url TEXT,
    clinician_name VARCHAR(200),
    clinician_qualifications TEXT,
    sanc_number VARCHAR(30),
    hpcsa_number VARCHAR(30),
    created_by_user_id UUID NOT NULL,
    updated_by_user_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
