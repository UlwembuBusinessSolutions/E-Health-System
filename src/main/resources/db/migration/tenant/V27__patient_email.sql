-- Cross-tenant patient migration needs a way to notify a migrated patient by
-- email; not required at registration (many patients have none on file) —
-- PatientService.sendPatientMigratedEmail() simply skips the notification
-- when this is null. Mutable, unlike idNumber/mpiNumber/etc — PatientService.update()'s
-- own contact-details grouping (address, contactNumber) is the right
-- precedent, not the identity fields that are fixed at construction.
ALTER TABLE patients ADD COLUMN email VARCHAR(255);
