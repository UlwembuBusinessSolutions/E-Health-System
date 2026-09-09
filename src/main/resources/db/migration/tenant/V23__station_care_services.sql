ALTER TABLE stations
    ADD COLUMN care_service VARCHAR(30) NOT NULL DEFAULT 'MEDICAL';

ALTER TABLE stations
    ADD CONSTRAINT stations_care_service_check
    CHECK (care_service IN ('MEDICAL', 'SURGICAL', 'DIAGNOSTIC', 'LONG_TERM_CARE'));