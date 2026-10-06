INSERT INTO roles (id, name) VALUES (gen_random_uuid(), 'Stock Control Manager') ON CONFLICT (name) DO NOTHING;
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.name = 'Stock Control Manager' AND p.code = 'PHRM:MANAGE'
ON CONFLICT DO NOTHING;
