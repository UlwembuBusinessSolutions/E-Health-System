-- HR facts that ARE known at hiring time, and belong right next to the
-- rest of the staff profile.
ALTER TABLE users
    ADD COLUMN profile_photo_url VARCHAR(500),
    ADD COLUMN employment_type VARCHAR(30)
        CHECK (employment_type IN ('PERMANENT','CONTRACT','INTERN','COMMUNITY_SERVICE',
                                    'EXTENDED_PUBLIC_WORKS','SECONDED')),
    ADD COLUMN employment_end_date DATE,
    ADD COLUMN sanc_expiry_date DATE,
    ADD COLUMN hpcsa_expiry_date DATE,
    ADD COLUMN sapc_expiry_date DATE,
    ADD COLUMN emergency_contact_name VARCHAR(200),
    ADD COLUMN emergency_contact_relationship VARCHAR(50),
    ADD COLUMN emergency_contact_phone VARCHAR(20);

-- Deliberately a separate table, not more columns on users. Race and
-- disability status are "special personal information" under POPIA — the
-- same category health data falls into, which is why background-check
-- outcome and occupational health clearance live here too. Splitting them
-- out means a future access-control layer can restrict this table
-- independently of the general staff roster.
CREATE TABLE user_compliance_details (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    race VARCHAR(30) CHECK (race IN ('AFRICAN','COLOURED','INDIAN','WHITE','OTHER','PREFER_NOT_TO_SAY')),
    disability_status VARCHAR(20)
        CHECK (disability_status IN ('NONE','DISABLED','PREFER_NOT_TO_SAY')),
    background_check_date DATE,
    background_check_status VARCHAR(20) CHECK (background_check_status IN ('PENDING','CLEARED','FLAGGED')),
    occupational_health_clearance_date DATE
);
