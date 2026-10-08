-- A cancelled receipt takes its stock off the shelf, so a scheduled medicine
-- needs a matching register entry. REVERSED is that entry: it removes stock
-- and, like DESTROYED and LOST, carries a written reason.
ALTER TABLE pharmacy_schedule_register_entries DROP CONSTRAINT pharmacy_schedule_register_entries_kind_check;
ALTER TABLE pharmacy_schedule_register_entries ADD CONSTRAINT pharmacy_schedule_register_entries_kind_check
    CHECK (kind IN ('DISPENSED', 'RECEIVED', 'DESTROYED', 'LOST', 'RETURNED', 'OPENING', 'REVERSED'));
