CREATE TABLE patient_next_of_kin (
    patient_id UUID NOT NULL REFERENCES patients(id),
    name VARCHAR(200) NOT NULL,
    relationship VARCHAR(100) NOT NULL,
    contact_number VARCHAR(20) NOT NULL
);