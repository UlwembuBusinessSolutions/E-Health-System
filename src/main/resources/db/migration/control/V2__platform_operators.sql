-- Platform operators are the seller's own team, not scoped to any
-- organization — same reasoning that put organizations in control rather
-- than a tenant schema: these accounts have to exist before any tenant
-- does, and aren't any tenant's business to query.
CREATE TABLE control.platform_operators (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(200) NOT NULL UNIQUE,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    password_hash VARCHAR(100) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'LOCKED', 'DISABLED')),
    failed_login_count INT NOT NULL DEFAULT 0,
    last_failed_login_at TIMESTAMPTZ,
    locked_at TIMESTAMPTZ,
    token_version INT NOT NULL DEFAULT 0,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Which operator did what, to which organization — the seller-side view,
-- across every client at once. Deliberately separate from each tenant's
-- own audit_log: a platform operator isn't a row in any tenant's users
-- table, so attributing an action to one there was never going to be more
-- than a workaround.
CREATE TABLE control.platform_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    platform_operator_id UUID NOT NULL REFERENCES control.platform_operators(id),
    action VARCHAR(100) NOT NULL,
    organization_id UUID REFERENCES control.organizations(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
