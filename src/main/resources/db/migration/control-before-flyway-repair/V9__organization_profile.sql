-- Org-wide contact/location profile — see
-- core/tenant/OrganizationProfile.java. Same JSONB-column shape as
-- branding/mail_settings; a future public tenant site reads this instead
-- of anything being hardcoded.
ALTER TABLE control.organizations ADD COLUMN profile JSONB NOT NULL DEFAULT '{}';
