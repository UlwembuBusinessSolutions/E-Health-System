-- PHRM-US-018: a dispense creates one immutable stock movement per medicine
-- line, carrying the named patient's identity with it.
CREATE TABLE stock_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prescription_id UUID NOT NULL REFERENCES prescriptions(id),
    patient_id UUID NOT NULL REFERENCES patients(id),
    patient_mpi VARCHAR(20) NOT NULL,
    drug_name VARCHAR(200) NOT NULL,
    quantity INT NOT NULL CHECK (quantity > 0),
    moved_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_stock_movements_prescription ON stock_movements(prescription_id);
CREATE INDEX idx_stock_movements_patient ON stock_movements(patient_id);
