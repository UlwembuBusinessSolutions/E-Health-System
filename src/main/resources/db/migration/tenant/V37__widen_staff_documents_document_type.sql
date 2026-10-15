-- V36 sized document_type as VARCHAR(30), but StaffDocumentType's own
-- longest constant, PROFESSIONAL_REGISTRATION_CERTIFICATE, is 37
-- characters — every upload of that one document type would have failed
-- at the INSERT with "value too long for type character varying(30)".
-- Found by seeding a real row while verifying the staff-documents feature,
-- not by a code review. Widened generously past the longest current
-- constant so a future addition doesn't hit the same wall.
ALTER TABLE staff_documents ALTER COLUMN document_type TYPE VARCHAR(60);
