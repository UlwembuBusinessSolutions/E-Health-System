-- Admin-direct staff creation replaces self-service request+approval as the
-- primary onboarding path. These columns support the fuller profile that
-- capture requires, plus the time-bound lockout policy AuthService.login()
-- runs instead of a permanent-LOCKED-until-manually-fixed design.
--
-- gender has no NOT NULL here even though the API requires it going forward
-- — this is an ALTER TABLE on a table that may already have rows in a real
-- deployment history, and Postgres would reject a NOT NULL addition against
-- existing NULLs without a DEFAULT. Enforced at the application layer for
-- new staff instead.
ALTER TABLE users
    ADD COLUMN must_change_password BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN department VARCHAR(100),
    ADD COLUMN designation VARCHAR(100),
    ADD COLUMN date_of_birth DATE,
    ADD COLUMN gender VARCHAR(10) CHECK (gender IN ('MALE', 'FEMALE', 'OTHER')),
    ADD COLUMN sanc_number VARCHAR(30) UNIQUE,
    ADD COLUMN hpcsa_number VARCHAR(30) UNIQUE,
    ADD COLUMN sapc_number VARCHAR(30) UNIQUE,
    ADD COLUMN email_verified_at TIMESTAMPTZ,
    ADD COLUMN contact_verified_at TIMESTAMPTZ,
    ADD COLUMN last_failed_login_at TIMESTAMPTZ,
    ADD COLUMN locked_at TIMESTAMPTZ;
