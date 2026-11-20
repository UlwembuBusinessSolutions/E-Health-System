ALTER TABLE patients
    ADD COLUMN whatsapp_opt_in BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN whatsapp_opted_in_at TIMESTAMPTZ;

ALTER TABLE queue_tokens
    ADD COLUMN approach_whatsapp_sent_at TIMESTAMPTZ;
