-- Every tenant schema needs the same starter role set the instant it's
-- provisioned. Without this, OrganizationProvisioningService has nothing
-- to assign a brand-new org's first admin, and GET /api/v1/roles would be
-- empty for every new client until someone remembered to seed it by hand.
INSERT INTO roles (id, name) VALUES
    (gen_random_uuid(), 'ORG_ADMIN'),
    (gen_random_uuid(), 'Facility Manager'),
    (gen_random_uuid(), 'Admin Staff'),
    (gen_random_uuid(), 'Doctor'),
    (gen_random_uuid(), 'Professional Nurse'),
    (gen_random_uuid(), 'Clinician'),
    (gen_random_uuid(), 'Pharmacist'),
    (gen_random_uuid(), 'Queue Marshall'),
    (gen_random_uuid(), 'Social Worker');
