ALTER TABLE control.platform_operators ADD COLUMN email_verified_at TIMESTAMPTZ;
UPDATE control.platform_operators SET email_verified_at = created_at WHERE email_verified_at IS NULL;

CREATE TABLE control.platform_password_reset_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    operator_id UUID NOT NULL REFERENCES control.platform_operators(id),
    token_hash VARCHAR(100) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    consumed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_platform_password_reset_tokens_operator
    ON control.platform_password_reset_tokens(operator_id, created_at DESC)
    WHERE consumed_at IS NULL;
