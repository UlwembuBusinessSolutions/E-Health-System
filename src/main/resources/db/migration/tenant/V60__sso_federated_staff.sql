-- IAM-F01: federated employees are not required to have a platform password,
-- HR number, contact phone or assigned clinical facility on first IdP login.
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;
ALTER TABLE users ALTER COLUMN employee_number DROP NOT NULL;
ALTER TABLE users ALTER COLUMN contact_number DROP NOT NULL;
ALTER TABLE users ADD COLUMN external_issuer VARCHAR(350), ADD COLUMN external_subject VARCHAR(350);
CREATE UNIQUE INDEX users_external_identity_unique ON users (external_issuer, external_subject)
    WHERE external_issuer IS NOT NULL AND external_subject IS NOT NULL;
-- This role has no clinical permissions; HR/tenant administrator grants roles separately.
INSERT INTO roles (id, name) VALUES (gen_random_uuid(), 'SSO_EMPLOYEE') ON CONFLICT (name) DO NOTHING;
