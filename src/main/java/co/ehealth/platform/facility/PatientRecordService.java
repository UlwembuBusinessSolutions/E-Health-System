package co.ehealth.platform.facility;

import co.ehealth.platform.core.audit.AuditLogService;
import co.ehealth.platform.identity.User;
import co.ehealth.platform.identity.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

// Patient record service — single write path for all patient record operations.
// Implements compliance requirement BR-PREG-150: patient records are immutable,
// never deleted, only archived. Every significant operation is audit-logged.
//
// Same module-boundary discipline as StaffService: reaches into
// UserRepository only to validate that a staff member exists (the user
// performing the archive); everything else routes through repositories via
// this service's own methods, never directly by callers.
@Service
public class PatientRecordService {

    private final PatientRecordRepository patientRecordRepository;
    private final UserRepository userRepository;
    private final AuditLogService auditLogService;

    public PatientRecordService(PatientRecordRepository patientRecordRepository,
            UserRepository userRepository, AuditLogService auditLogService) {
        this.patientRecordRepository = patientRecordRepository;
        this.userRepository = userRepository;
        this.auditLogService = auditLogService;
    }

    // ============ CREATE ============

    // Create a new patient record in ACTIVE state. Called by
    // PatientRecordController.createRecord() after authorization and
    // validation. Runs inside @Transactional so that if auditLogService.
    // append() fails, the entire record creation rolls back.
    @Transactional
    public PatientRecord createRecord(String mrn, String firstName, String lastName,
            java.time.LocalDate dateOfBirth, UUID creatingStaffId, String ipAddress) {

        // Validate MRN uniqueness at the application layer; database unique
        // constraint is a backup for race conditions (two simultaneous
        // identical creations landing close enough that both pass this check).
        if (patientRecordRepository.existsByMrn(mrn)) {
            throw new DuplicatePatientRecordException("mrn",
                    "A patient record with this MRN already exists.");
        }

        // Validate that the creating staff member exists.
        if (!userRepository.existsById(creatingStaffId)) {
            throw new IllegalArgumentException("Creating staff member not found.");
        }

        PatientRecord record = new PatientRecord(mrn, firstName, lastName, dateOfBirth);
        patientRecordRepository.save(record);

        // Audit the creation — before_value is null (new record), after_value
        // is the record's new state.
        auditLogService.append(creatingStaffId, null, "PATIENT_RECORD_CREATED",
                "PatientRecord", record.getId().toString(), null,
                formatRecordSnapshot(record), ipAddress);

        return record;
    }

    // ============ READ ============

    // Fetch a single record by ID. Throws RecordNotFoundException if not
    // found. Allows reading both ACTIVE and ARCHIVED records; authorization
    // (whether this staff member can read this patient's records) is left to
    // the controller layer, not enforced here.
    @Transactional(readOnly = true)
    public PatientRecord getRecord(UUID recordId) {
        return patientRecordRepository.findById(recordId)
                .orElseThrow(RecordNotFoundException::new);
    }

    // Fetch a single record by Medical Record Number (MRN). Returns empty if
    // not found. Used by controllers to look up a patient before operations.
    @Transactional(readOnly = true)
    public java.util.Optional<PatientRecord> getRecordByMrn(String mrn) {
        return patientRecordRepository.findByMrn(mrn);
    }

    // Fetch all ACTIVE patient records. The normal query for "what patients
    // are currently in our system." Archived records don't appear in results.
    @Transactional(readOnly = true)
    public List<PatientRecord> listActiveRecords() {
        return patientRecordRepository.findAllByStatus(PatientRecordStatus.ACTIVE);
    }

    // Fetch all ARCHIVED records. Used by compliance/audit staff to review
    // withdrawn records and who withdrew them. Intentionally separate from
    // listActiveRecords() so that the queries can't accidentally mix states.
    @Transactional(readOnly = true)
    public List<PatientRecord> listArchivedRecords() {
        return patientRecordRepository.findAllByStatus(PatientRecordStatus.ARCHIVED);
    }

    // Search ACTIVE records by name fragment. Case-insensitive substring
    // match on firstName or lastName. Returns only ACTIVE records.
    @Transactional(readOnly = true)
    public List<PatientRecord> searchActiveRecordsByName(String nameFragment) {
        if (nameFragment == null || nameFragment.isBlank()) {
            return List.of();
        }
        return patientRecordRepository.searchActiveByName(nameFragment.trim());
    }

    // Audit query: list all records archived by a specific staff member.
    // Used to answer "which records did this admin archive?" for compliance
    // review. Only returns ARCHIVED records.
    @Transactional(readOnly = true)
    public List<PatientRecord> listRecordsArchivedBy(UUID staffUserId) {
        return patientRecordRepository.findAllByStatusAndArchivedBy(
                PatientRecordStatus.ARCHIVED, staffUserId);
    }

    // ============ ARCHIVE (the only write operation after creation) ============

    // Archive a patient record — transition from ACTIVE to ARCHIVED state.
    // This is the only way to withdraw a record from active use. The record
    // remains in the database forever (immutable by design); it simply stops
    // appearing in listActiveRecords() queries.
    //
    // Throws:
    // - RecordNotFoundException if the record doesn't exist
    // - RecordAlreadyArchivedException if already ARCHIVED (idempotent,
    // but makes the caller's intent explicit)
    // - IllegalArgumentException if the archiving staff member doesn't exist
    //
    // Runs inside @Transactional to ensure the record state change and audit
    // log entry both succeed or both rollback together.
    @Transactional
    public void archiveRecord(UUID recordId, UUID archivingStaffId, String ipAddress) {
        PatientRecord record = patientRecordRepository.findById(recordId)
                .orElseThrow(RecordNotFoundException::new);

        if (record.getStatus() == PatientRecordStatus.ARCHIVED) {
            throw new RecordAlreadyArchivedException(
                    "This record is already archived. No action taken.");
        }

        // Validate that the archiving staff member exists.
        if (!userRepository.existsById(archivingStaffId)) {
            throw new IllegalArgumentException("Archiving staff member not found.");
        }

        // Capture the record's state BEFORE archiving (for before_value in
        // audit log).
        String beforeSnapshot = formatRecordSnapshot(record);

        // Perform the state transition.
        record.archive(archivingStaffId);
        patientRecordRepository.save(record);

        // Audit the archival — full before/after snapshot, so auditors can see exactly
        // what changed and when.
        auditLogService.append(archivingStaffId, null, "PATIENT_RECORD_ARCHIVED",
                "PatientRecord", record.getId().toString(), beforeSnapshot,
                formatRecordSnapshot(record), ipAddress);
    }

    // ============ DELETE (INTENTIONALLY REJECTED, WITH AUDIT) ============

    // The actual handler behind DELETE /api/v1/records/{id}. Unlike
    // deleteRecord() below, this one is reachable from a real HTTP request,
    // so it's the one responsible for satisfying BR-PREG-150's audit
    // requirement: the attempt itself — who tried, on which record, from
    // which IP — is written to audit_log before the request is rejected.
    // Runs regardless of role, including ORG_ADMIN/Super Admin — deletion
    // has no authorized path at all, so there's nothing to gate here the
    // way archiveRecord() gates on ORG_ADMIN.
    // @Transactional
    // public void rejectDeletion(UUID recordId, UUID actingUserId, String
    // ipAddress) {
    // auditLogService.append(actingUserId, null, "PATIENT_RECORD_DELETE_ATTEMPTED",
    // "PatientRecord", recordId.toString(), null, null, ipAddress);
    // throw new UnsupportedOperationException(
    // "COMPLIANCE (BR-PREG-150): Patient records are immutable and cannot be
    // deleted. "
    // + "Use archiveRecord() via PatientRecordService to withdraw from active use.
    // "
    // + "The clinical and legal record must be preserved in full.");
    // }

    @Transactional(noRollbackFor = UnsupportedOperationException.class)
    public void rejectDeletion(UUID recordId, UUID actingUserId, String ipAddress) {
        auditLogService.append(actingUserId, null, "PATIENT_RECORD_DELETE_ATTEMPTED",
                "PatientRecord", recordId.toString(), null, null, ipAddress);
        throw new UnsupportedOperationException(
                "COMPLIANCE (BR-PREG-150): Patient records are immutable and cannot be deleted. "
                        + "Use archiveRecord() via PatientRecordService to withdraw from active use. "
                        + "The clinical and legal record must be preserved in full.");
    }

    // ============ DELETE (INTENTIONALLY BLOCKED) ============

    // This method MUST NOT exist in the public API. It's here only as a
    // safety catch in case something tries to call it directly (bypassing
    // the controller, e.g. a background job or future code path) — the
    // audited, HTTP-facing rejection is rejectDeletion() above. This one
    // will throw rather than silently succeeding, but doesn't audit —
    // there's no acting user or IP to attribute it to at this layer.
    @Deprecated
    public void deleteRecord(UUID recordId) {
        throw new UnsupportedOperationException(
                "COMPLIANCE (BR-PREG-150): Patient records cannot be deleted. "
                        + "Use archiveRecord() to withdraw from active use. "
                        + "The clinical and legal record must be preserved in full.");
    }

    // ============ PRIVATE HELPERS ============

    // Format a PatientRecord as a JSON snapshot for audit logging. Captures
    // all relevant fields so an auditor can see exactly what the record
    // looked like at creation, archival, or any other point in time.
    private String formatRecordSnapshot(PatientRecord record) {
        // In a real system, this would serialize to JSON via a JSON mapper
        // (ObjectMapper, Gson, etc.). For now, a simple string representation
        // that's still audit-trail-safe.
        return String.format(
                "{\"id\":\"%s\",\"mrn\":\"%s\",\"firstName\":\"%s\",\"lastName\":\"%s\","
                        + "\"status\":\"%s\",\"archivedAt\":%s,\"archivedBy\":%s}",
                record.getId(), record.getMrn(), record.getFirstName(),
                record.getLastName(), record.getStatus(),
                record.getArchivedAt() != null ? "\"" + record.getArchivedAt() + "\"" : "null",
                record.getArchivedBy() != null ? "\"" + record.getArchivedBy() + "\"" : "null");
    }
}
