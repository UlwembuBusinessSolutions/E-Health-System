-- Expand legacy primary-clinic roles to the additional clinics already assigned to staff.
INSERT INTO user_roles (user_id, role_id, facility_id)
SELECT DISTINCT ur.user_id, ur.role_id, uf.facility_id
FROM user_roles ur
JOIN users u ON u.id = ur.user_id AND u.facility_id = ur.facility_id
JOIN user_facilities uf ON uf.user_id = ur.user_id
ON CONFLICT DO NOTHING;

ALTER TABLE patients ADD COLUMN facility_id UUID REFERENCES facilities(id);
-- Only backfill a reliable single-clinic visit history, then the registering user's primary clinic.
UPDATE patients p SET facility_id = v.facility_id
FROM (SELECT patient_id, (array_agg(DISTINCT facility_id))[1] AS facility_id
      FROM visits GROUP BY patient_id HAVING count(DISTINCT facility_id) = 1) v
WHERE v.patient_id = p.id;
UPDATE patients p SET facility_id = u.facility_id FROM users u
WHERE p.registered_by_user_id = u.id AND p.facility_id IS NULL
  AND NOT EXISTS (SELECT 1 FROM visits v WHERE v.patient_id = p.id);
CREATE INDEX idx_patients_facility ON patients(facility_id);
CREATE INDEX idx_visits_facility_time ON visits(facility_id, visit_datetime DESC);
ALTER TABLE audit_log ADD COLUMN clinic_context_id UUID REFERENCES facilities(id);
CREATE INDEX idx_audit_clinic_context ON audit_log(clinic_context_id, created_at DESC);
