INSERT INTO roles (id, name) VALUES (gen_random_uuid(), 'Medical Officer') ON CONFLICT (name) DO NOTHING;
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.name = 'Medical Officer' AND p.code = 'PHRM:MANAGE'
ON CONFLICT DO NOTHING;

CREATE INDEX idx_dispensing_records_prescriber_date
    ON dispensing_records (dispensed_at, prescription_item_id) WHERE prescriber_dispensed = TRUE;
