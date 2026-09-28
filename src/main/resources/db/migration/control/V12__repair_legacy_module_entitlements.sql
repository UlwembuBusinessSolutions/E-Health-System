-- Complete partially-created legacy module_entitlements tables. The V7
-- repair deliberately preserved an existing table; this follow-up brings a
-- table that predates V4's final shape up to the contract used by JPA.
ALTER TABLE control.module_entitlements
    ADD COLUMN IF NOT EXISTS organization_id UUID,
    ADD COLUMN IF NOT EXISTS module_code VARCHAR(10),
    ADD COLUMN IF NOT EXISTS enabled BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conrelid = 'control.module_entitlements'::regclass
          AND contype = 'f'
          AND confrelid = 'control.organizations'::regclass
    ) THEN
        ALTER TABLE control.module_entitlements
            ADD CONSTRAINT module_entitlements_organization_id_fkey
            FOREIGN KEY (organization_id) REFERENCES control.organizations(id);
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conrelid = 'control.module_entitlements'::regclass
          AND contype = 'u'
          AND conkey = ARRAY[
              (SELECT attnum FROM pg_attribute
               WHERE attrelid = 'control.module_entitlements'::regclass
                 AND attname = 'organization_id' AND NOT attisdropped),
              (SELECT attnum FROM pg_attribute
               WHERE attrelid = 'control.module_entitlements'::regclass
                 AND attname = 'module_code' AND NOT attisdropped)
          ]
    ) THEN
        ALTER TABLE control.module_entitlements
            ADD CONSTRAINT module_entitlements_organization_id_module_code_key
            UNIQUE (organization_id, module_code);
    END IF;
END $$;
