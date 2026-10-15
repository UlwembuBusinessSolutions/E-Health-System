-- Conformance-test finding from V12's own rollout: this system's "Start a
-- visit" action (VisitService.createVisit(), RECQ:MANAGE) is reachable by
-- any authenticated staff member in the actual product UI (PatientDetailPage
-- has no RequireRole gate on it — router.tsx's own why-note: "registering
-- and finding a patient is front-line reception/clinical work, not admin
-- territory"). V12 seeded Doctor, Professional Nurse, Clinician and
-- Occupational Health Practitioner with RECQ:VIEW only, which blocked them
-- from the exact clinical workflow this session already built and
-- browser-tested — a real regression, caught by curl-testing the matrix
-- against a live Doctor login rather than assumed correct from the design
-- alone. VIEW rows are left in place rather than removed: MANAGE is treated
-- as a strict superset at evaluation time (PermissionService), so the
-- redundant VIEW row is harmless, and removing it would just be a second
-- migration's worth of churn for no behavioural difference.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM (VALUES
    ('Doctor', 'RECQ:MANAGE'),
    ('Professional Nurse', 'RECQ:MANAGE'),
    ('Clinician', 'RECQ:MANAGE'),
    ('Occupational Health Practitioner', 'RECQ:MANAGE')
) AS matrix(role_name, permission_code)
JOIN roles r ON r.name = matrix.role_name
JOIN permissions p ON p.code = matrix.permission_code;
