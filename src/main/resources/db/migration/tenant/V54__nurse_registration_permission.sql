-- Offline registration story: nurses at remote sites must be able to register
-- patients. V12 seeded these two roles with PREG:VIEW only. MANAGE is a strict
-- superset at evaluation time (PermissionService), so the VIEW rows stay.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM (VALUES
    ('Professional Nurse', 'PREG:MANAGE'),
    ('Occupational Health Practitioner', 'PREG:MANAGE')
) AS matrix(role_name, permission_code)
JOIN roles r ON r.name = matrix.role_name
JOIN permissions p ON p.code = matrix.permission_code;