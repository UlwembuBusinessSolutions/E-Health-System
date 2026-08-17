package co.ehealth.platform.facility;

// Patient record lifecycle state — never DELETED, only ARCHIVED. Compliance
// requirement (BR-PREG-150): clinical and legal records are immutable and
// preserved in full. ARCHIVED records remain in the database for audit trail
// and compliance review; they simply don't appear in normal "active records"
// queries. Any attempt to physically delete a PatientRecord is rejected at
// both the service and repository layers with a 403 FORBIDDEN response and
// an audit log entry.
public enum PatientRecordStatus {
    ACTIVE, // Record is in active clinical use
    ARCHIVED // Withdrawn from active use, but preserved immutably
}
