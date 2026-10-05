-- Medicines a prescriber wants the patient to BUY rather than receive from the
-- clinic pharmacy: the stock is out, short, or the medicine is not one the
-- pharmacy carries. They live apart from prescription_items on purpose: the
-- dispensing queue, partial dispensing and stock all work on prescription_items,
-- so nothing there can mistake a "go and buy this" line for something to hand over.
CREATE TABLE prescription_purchase_items (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prescription_id  UUID         NOT NULL REFERENCES prescriptions(id),
    drug_name        VARCHAR(200) NOT NULL,
    dosage           VARCHAR(100) NOT NULL,
    quantity         INTEGER      NOT NULL CHECK (quantity > 0),
    product_id       UUID REFERENCES pharmacy_products(id),
    reason           VARCHAR(20)  NOT NULL CHECK (reason IN ('OUT_OF_STOCK', 'SHORT_STOCK', 'NOT_STOCKED')),
    note             VARCHAR(300)
);

CREATE INDEX idx_prescription_purchase_items_prescription ON prescription_purchase_items (prescription_id);
