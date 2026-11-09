-- Only the prescriber chooses the medicine now, so the table that remembered which
-- product a pharmacist matched to a typed drug name is no longer used.
DROP TABLE IF EXISTS pharmacy_drug_mappings;
