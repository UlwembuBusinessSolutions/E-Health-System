-- Per-tenant outbound email (SMTP) settings — see
-- core/tenant/OrganizationMailSettings.java and
-- core/notification/EmailService.java. Same JSONB-column shape as
-- V1__organizations.sql's branding column; the password field inside it is
-- stored encrypted (core/common/SecretEncryptor.java), never in plaintext.
ALTER TABLE control.organizations ADD COLUMN mail_settings JSONB NOT NULL DEFAULT '{}';
