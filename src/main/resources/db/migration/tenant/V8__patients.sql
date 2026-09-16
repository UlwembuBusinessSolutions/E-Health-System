CREATE SEQUENCE patient_mpi_seq START WITH 1;

CREATE TABLE patients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mpi_number VARCHAR(20) NOT NULL UNIQUE,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    date_of_birth DATE NOT NULL,
    gender VARCHAR(10) NOT NULL,
    citizenship_status VARCHAR(20) NOT NULL,
    id_number VARCHAR(13) NOT NULL UNIQUE,
    address VARCHAR(500) NOT NULL,
    contact_number VARCHAR(20) NOT NULL,
    medical_aid_provider VARCHAR(100),
    medical_aid_number VARCHAR(50),
    registered_by_user_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- PREG-US-008's search — name lookups are always case-insensitive substring
-- matches (PatientService.search()'s own query), so the index needs to be
-- on the lowercased form to actually get used.
CREATE INDEX idx_patients_name ON patients (LOWER(first_name), LOWER(last_name));
