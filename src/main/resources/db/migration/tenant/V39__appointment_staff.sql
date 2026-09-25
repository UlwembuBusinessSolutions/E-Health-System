ALTER TABLE appointments ADD COLUMN assigned_staff_id UUID REFERENCES users(id);
CREATE INDEX idx_appointments_assigned_staff ON appointments(assigned_staff_id) WHERE assigned_staff_id IS NOT NULL;
