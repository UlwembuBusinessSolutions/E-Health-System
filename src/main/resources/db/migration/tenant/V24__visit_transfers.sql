-- QueueService.transferToken() — a cross-facility ticket transfer creates a
-- brand-new Visit at the destination facility rather than mutating
-- Visit.facilityId on the original: Visit's own class comment says nothing
-- about an existing visit changes after creation, and QueueToken.facilityId
-- is deliberately denormalized from its visit specifically so the two never
-- disagree (QueueToken's own why-note). This column is the only link
-- between the origin and destination visits, for traceability.
ALTER TABLE visits ADD COLUMN transferred_from_visit_id UUID REFERENCES visits(id);
