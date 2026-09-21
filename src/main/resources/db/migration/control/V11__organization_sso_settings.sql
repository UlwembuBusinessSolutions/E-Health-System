-- Per-organization Microsoft SSO (Azure AD / Entra ID) configuration —
-- see core/tenant/OrganizationSsoSettings.java. Same JSONB-column shape as
-- branding/mail_settings/profile; the client secret inside it is stored
-- encrypted (core/common/SecretEncryptor.java), never in plaintext.
ALTER TABLE control.organizations ADD COLUMN sso_settings JSONB NOT NULL DEFAULT '{}';
