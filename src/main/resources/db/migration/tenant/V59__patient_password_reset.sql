CREATE TABLE patient_password_reset_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_account_id UUID NOT NULL REFERENCES patient_accounts(id) ON DELETE CASCADE,
    code_hash VARCHAR(100) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    attempt_count INTEGER NOT NULL DEFAULT 0,
    consumed_at TIMESTAMPTZ,
    requested_ip VARCHAR(64),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX patient_password_reset_tokens_account_created
    ON patient_password_reset_tokens (patient_account_id, created_at DESC)
    WHERE consumed_at IS NULL;
