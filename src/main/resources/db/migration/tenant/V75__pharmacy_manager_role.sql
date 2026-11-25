INSERT INTO roles (id, name)
SELECT gen_random_uuid(), 'Pharmacy Manager'
WHERE NOT EXISTS (SELECT 1 FROM roles WHERE name = 'Pharmacy Manager');

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code = 'PHRM:MANAGE'
WHERE r.name = 'Pharmacy Manager'
  AND NOT EXISTS (
      SELECT 1 FROM role_permissions rp
      WHERE rp.role_id = r.id AND rp.permission_id = p.id
  );
