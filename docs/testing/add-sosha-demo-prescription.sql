-- Local demo setup only. This creates an explicitly synthetic, uncleared
-- prescription, not a clinical order attributed to an existing staff member.
-- Run with psql -v ON_ERROR_STOP=1 against the local development database.
BEGIN;
SET LOCAL search_path TO amo;
DO $$
DECLARE
  clinic UUID := '98e1948d-18bd-4381-91c1-8f4cec392fa2';
  medicine UUID;
  demo_patient UUID;
  demo_visit UUID;
  demo_rx UUID;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('local-setup:amo:sosha:demo-prescription'));
  IF NOT EXISTS (SELECT 1 FROM facilities WHERE id=clinic AND name='sosha' AND active) THEN
    RAISE EXCEPTION 'Expected active sosha clinic not found';
  END IF;
  SELECT p.id INTO medicine FROM pharmacy_products p
    JOIN pharmacy_facility_products a ON a.product_id=p.id
    WHERE p.code_normalized='FORM-AML5' AND p.active AND a.active
      AND a.facility_id=clinic AND p.base_unit='TABLET' AND p.pack_size=30;
  IF medicine IS NULL THEN RAISE EXCEPTION 'Expected Amlodipine product not found at sosha'; END IF;
  IF EXISTS (SELECT 1 FROM prescriptions WHERE serial_number='DEMO-PHRM-006') THEN
    RAISE NOTICE 'Demo prescription already exists; quantities and review state preserved';
    RETURN;
  END IF;
  INSERT INTO patients(mpi_number,first_name,last_name,date_of_birth,gender,citizenship_status,id_number,address,contact_number)
    VALUES('DEMO-PHRM-006','Demo','Pharmacy Patient','1990-01-01','FEMALE','SA_CITIZEN','9999999900006','Synthetic local demo record - not a real patient','+27000000000')
    RETURNING id INTO demo_patient;
  INSERT INTO visits(patient_id,facility_id,visit_type,service_stream,visit_datetime)
    VALUES(demo_patient,clinic,'NEW','PHARMACY',now()) RETURNING id INTO demo_visit;
  INSERT INTO prescriptions(serial_number,visit_id,patient_id,facility_id,prescriber_id)
    VALUES('DEMO-PHRM-006',demo_visit,demo_patient,clinic,'00000000-0000-4000-8000-000000000006') RETURNING id INTO demo_rx;
  INSERT INTO prescription_items(prescription_id,drug_name,dosage,quantity,product_id,clinical_check_status,clinical_check_note)
    VALUES(demo_rx,'Amlodipine 5 mg','DEMO ONLY - workflow test; not a treatment instruction',30,medicine,'REVIEW_REQUIRED','Synthetic demo prescription. Clinical review has not been performed.');
  INSERT INTO audit_log(facility_id,action,entity_type,entity_id,after_value)
    VALUES(clinic,'LOCAL_PHARMACY_DEMO_SETUP','Prescription',demo_rx::text,
      jsonb_build_object('source','User-requested assistant local development setup','synthetic',true,'serialNumber','DEMO-PHRM-006','quantity',30,'clinicalCheckStatus','REVIEW_REQUIRED'));
END $$;
COMMIT;
SELECT p.serial_number,pt.first_name || ' ' || pt.last_name AS patient,f.name AS clinic,
  i.drug_name,i.quantity,i.dispensed_quantity,i.clinical_check_status
FROM amo.prescriptions p JOIN amo.patients pt ON pt.id=p.patient_id
JOIN amo.facilities f ON f.id=p.facility_id
JOIN amo.prescription_items i ON i.prescription_id=p.id
WHERE p.serial_number='DEMO-PHRM-006';
