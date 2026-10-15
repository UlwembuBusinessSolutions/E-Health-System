-- FacilityType.java gained a 4th value, PHARMACY (ConsultationService's
-- "Send to pharmacy" outcome needs a real destination facility to transfer
-- a visit's queue token to) — V1__facilities.sql's original CHECK
-- constraint only allowed the first 3 values and would silently reject
-- every insert/update of a PHARMACY-typed row with a generic constraint-
-- violation 409 rather than the friendly "code already in use" one
-- DuplicateFieldException gives, since the two look identical to
-- GlobalExceptionHandler's DataIntegrityViolationException catch-all.
ALTER TABLE facilities DROP CONSTRAINT facilities_type_check;
ALTER TABLE facilities ADD CONSTRAINT facilities_type_check
    CHECK (type IN ('CLINIC', 'HOSPITAL', 'STORE', 'PHARMACY'));
