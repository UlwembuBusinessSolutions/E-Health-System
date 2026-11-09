CREATE TABLE role_mfa_policies (
    role_id    UUID PRIMARY KEY REFERENCES roles(id) ON DELETE CASCADE,
    policy     VARCHAR(10) NOT NULL CHECK (policy IN ('OPTIONAL', 'MANDATORY')),
    updated_by UUID,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE user_mfa (
    user_id          UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    secret_encrypted TEXT NOT NULL,
    status           VARCHAR(10) NOT NULL CHECK (status IN ('PENDING', 'ACTIVE')),
    last_used_step   BIGINT NOT NULL DEFAULT 0,
    failed_attempts  INT NOT NULL DEFAULT 0,
    enrolled_at      TIMESTAMPTZ,
    created_at       TIMESTAMPTZ NOT NULL
);

CREATE TABLE mfa_recovery_codes (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    code_hash  VARCHAR(64) NOT NULL,
    used_at    TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX idx_mfa_recovery_codes_user ON mfa_recovery_codes (user_id, code_hash);

CREATE TABLE mfa_challenges (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    token_hash    VARCHAR(64) NOT NULL UNIQUE,
    user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    purpose       VARCHAR(10) NOT NULL CHECK (purpose IN ('VERIFY', 'ENROL')),
    attempt_count INT NOT NULL DEFAULT 0,
    expires_at    TIMESTAMPTZ NOT NULL,
    consumed_at   TIMESTAMPTZ,
    created_at    TIMESTAMPTZ NOT NULL
);
CREATE INDEX idx_mfa_challenges_user ON mfa_challenges (user_id);