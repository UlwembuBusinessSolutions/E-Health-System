CREATE TABLE roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE role_permissions (
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_number VARCHAR(30) NOT NULL UNIQUE,
    id_number VARCHAR(13) UNIQUE,
    email VARCHAR(200) NOT NULL UNIQUE,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    contact_number VARCHAR(20) NOT NULL UNIQUE,
    password_hash VARCHAR(100) NOT NULL,
    facility_id UUID REFERENCES facilities(id),
    employment_start_date DATE,
    manager_id UUID REFERENCES users(id) ON DELETE SET NULL CHECK (manager_id <> id),
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','LOCKED','DISABLED')),
    failed_login_count INT NOT NULL DEFAULT 0,
    token_version INT NOT NULL DEFAULT 0,
    last_login_at TIMESTAMPTZ
);

-- user_roles.facility_id is nullable ("applies at every facility"), and
-- Postgres forbids a nullable column inside a composite PRIMARY KEY — so
-- uniqueness is two partial indexes instead of one composite PK.
CREATE TABLE user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    facility_id UUID REFERENCES facilities(id)
);

-- A staff member can work at more than one facility — rotating between
-- clinics, covering another site's shifts. users.facility_id above stays
-- their default/primary facility; this table is the authoritative "every
-- facility this person can work at" list, and always includes the primary
-- one too (duplicated rather than derived, so "which facilities can this
-- person work at" is one table read, not a UNION every caller has to
-- remember).
CREATE TABLE user_facilities (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    facility_id UUID NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, facility_id)
);

CREATE UNIQUE INDEX user_roles_unique_all_facilities
    ON user_roles (user_id, role_id) WHERE facility_id IS NULL;
CREATE UNIQUE INDEX user_roles_unique_per_facility
    ON user_roles (user_id, role_id, facility_id) WHERE facility_id IS NOT NULL;
