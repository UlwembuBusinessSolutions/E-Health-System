-- This migration only adds the column 
ALTER TABLE control.organizations
    ADD COLUMN sector_type VARCHAR(20) NOT NULL DEFAULT 'PRIVATE'
    CHECK (sector_type IN ('PUBLIC', 'PRIVATE', 'OCCUPATIONAL'));