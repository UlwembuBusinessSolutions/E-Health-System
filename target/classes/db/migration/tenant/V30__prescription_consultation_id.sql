-- Prescription.java's own why-note already anticipated exactly this
-- column ("...Consultation entity that doesn't exist yet (Phase 2)... out
-- of scope for this slice"). Purely additive and nullable: every existing
-- prescription, and every prescription created without ever visiting the
-- Consultation tab, simply has consultation_id = NULL. Zero change to
-- PrescriptionService.create()/dispense()'s existing behaviour — this is
-- display/traceability only ("which consultation led to this script").
ALTER TABLE prescriptions ADD COLUMN consultation_id UUID REFERENCES consultations(id);

CREATE INDEX idx_prescriptions_consultation ON prescriptions(consultation_id) WHERE consultation_id IS NOT NULL;
