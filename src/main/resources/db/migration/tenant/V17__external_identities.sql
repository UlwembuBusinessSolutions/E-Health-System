CREATE TABLE external_identities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider_type VARCHAR(10) NOT NULL,
    issuer VARCHAR(500) NOT NULL,
    subject VARCHAR(500) NOT NULL,
    email VARCHAR(200),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (provider_type, issuer, subject)
);
