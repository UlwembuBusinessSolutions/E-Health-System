ALTER TABLE consultations
    ADD COLUMN service_reason_code VARCHAR(30)
        CHECK (service_reason_code IS NULL OR service_reason_code IN (
            'ART', 'TUBERCULOSIS', 'OTHER', 'MENTAL_HEALTH', 'ASTHMA',
            'HYPERTENSION', 'EPILEPSY', 'DIABETES_MELLITUS'
        )),
    ADD COLUMN service_reason_note VARCHAR(300),
    ADD CONSTRAINT chk_consultation_service_reason_note
        CHECK (
            (service_reason_code = 'OTHER' AND service_reason_note IS NOT NULL
                AND length(trim(service_reason_note)) >= 3)
            OR (service_reason_code IS NOT NULL AND service_reason_code <> 'OTHER' AND service_reason_note IS NULL)
            OR (service_reason_code IS NULL AND service_reason_note IS NULL)
        );
