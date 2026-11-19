ALTER TABLE art_initiation_longitudinal_records
    RENAME COLUMN recorded_by_user_id TO signed_by_user_id;

ALTER TABLE art_initiation_longitudinal_records
    RENAME COLUMN recorded_at TO signed_at;

ALTER INDEX idx_art_initiation_longitudinal_visit_date
    RENAME TO idx_art_initiation_longitudinal_visit_signed;
