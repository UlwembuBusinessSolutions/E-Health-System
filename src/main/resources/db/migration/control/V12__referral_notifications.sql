CREATE TABLE control.referral_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_organization_id UUID NOT NULL REFERENCES control.organizations(id),
    source_schema VARCHAR(63) NOT NULL,
    source_organization_name VARCHAR(200) NOT NULL,
    source_referral_id UUID NOT NULL,
    destination_organization_id UUID NOT NULL REFERENCES control.organizations(id),
    destination_facility_id UUID NOT NULL,
    referral_type VARCHAR(20) NOT NULL CHECK (referral_type IN ('REFERRAL', 'TRANSFER')),
    created_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT referral_notifications_source_referral_unique UNIQUE (source_schema, source_referral_id)
);

CREATE INDEX idx_referral_notifications_destination
    ON control.referral_notifications(destination_organization_id, destination_facility_id, created_at);

CREATE TABLE control.referral_notification_acknowledgements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    notification_id UUID NOT NULL REFERENCES control.referral_notifications(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    acknowledged_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT referral_notification_ack_user_unique UNIQUE (notification_id, user_id)
);

CREATE INDEX idx_referral_notification_ack_user
    ON control.referral_notification_acknowledgements(user_id, notification_id);
