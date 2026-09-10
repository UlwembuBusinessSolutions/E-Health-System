CREATE TABLE control.tenant_sso_configurations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL UNIQUE REFERENCES control.organizations(id) ON DELETE CASCADE,
    provider_type VARCHAR(10) NOT NULL CHECK (provider_type IN ('OIDC', 'SAML')),
    enabled BOOLEAN NOT NULL DEFAULT FALSE,
    allow_native_login BOOLEAN NOT NULL DEFAULT TRUE,
    default_role VARCHAR(100) NOT NULL DEFAULT 'Admin Staff',
    issuer VARCHAR(500),
    client_id VARCHAR(500),
    client_secret TEXT,
    authorization_endpoint VARCHAR(1000),
    token_endpoint VARCHAR(1000),
    userinfo_endpoint VARCHAR(1000),
    jwks_uri VARCHAR(1000),
    entity_id VARCHAR(1000),
    sso_url VARCHAR(1000),
    signing_certificate TEXT,
    attribute_mapping JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT tenant_sso_oidc_fields CHECK (
        provider_type <> 'OIDC' OR (
            issuer IS NOT NULL AND client_id IS NOT NULL AND client_secret IS NOT NULL
            AND authorization_endpoint IS NOT NULL AND token_endpoint IS NOT NULL
        )
    ),
    CONSTRAINT tenant_sso_saml_fields CHECK (
        provider_type <> 'SAML' OR (
            entity_id IS NOT NULL AND sso_url IS NOT NULL AND signing_certificate IS NOT NULL
        )
    )
);
