package co.ehealth.platform.facility;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

// Patient record repository — with deletion blocked at the framework level.
// Compliance requirement (BR-PREG-150): records cannot be deleted via any
// path. Attempts to delete throw UnsupportedOperationException at the
// repository layer, before any DELETE SQL is ever executed. This ensures
// no code path — whether a controller, scheduled job, or direct database
// manipulation — can physically erase a patient record without going
// through the compliance layer.
@Repository
public interface PatientRecordRepository extends JpaRepository<PatientRecord, UUID> {

        // ============ COMPLIANCE ENFORCEMENT ============
        // Override all delete methods to block deletion entirely.

        @Override
        default void delete(PatientRecord entity) {
                throw new UnsupportedOperationException(
                                "COMPLIANCE (BR-PREG-150): Patient records are immutable and cannot be deleted. "
                                                + "Use archiveRecord() via PatientRecordService to withdraw from active use. "
                                                + "The clinical and legal record must be preserved in full.");
        }

        @Override
        default void deleteById(UUID id) {
                throw new UnsupportedOperationException(
                                "COMPLIANCE (BR-PREG-150): Patient records are immutable and cannot be deleted. "
                                                + "Use archiveRecord() via PatientRecordService to withdraw from active use. "
                                                + "The clinical and legal record must be preserved in full.");
        }

        @Override
        default void deleteAllById(Iterable<? extends UUID> ids) {
                throw new UnsupportedOperationException(
                                "COMPLIANCE (BR-PREG-150): Patient records are immutable and cannot be deleted. "
                                                + "Use archiveRecord() via PatientRecordService to withdraw from active use. "
                                                + "The clinical and legal record must be preserved in full.");
        }

        @Override
        default void deleteAll(Iterable<? extends PatientRecord> entities) {
                throw new UnsupportedOperationException(
                                "COMPLIANCE (BR-PREG-150): Patient records are immutable and cannot be deleted. "
                                                + "Use archiveRecord() via PatientRecordService to withdraw from active use. "
                                                + "The clinical and legal record must be preserved in full.");
        }

        @Override
        default void deleteAll() {
                throw new UnsupportedOperationException(
                                "COMPLIANCE (BR-PREG-150): Patient records are immutable and cannot be deleted. "
                                                + "Use archiveRecord() via PatientRecordService to withdraw from active use. "
                                                + "The clinical and legal record must be preserved in full.");
        }

        // ============ READ OPERATIONS ============

        // Find a record by its Medical Record Number (MRN), the primary patient
        // identifier in this system — more stable than email since patients may
        // not have email at all.
        Optional<PatientRecord> findByMrn(String mrn);

        // Find all records in ACTIVE state — the normal "active patient records"
        // query used by clinical staff. Archived records don't appear here.
        List<PatientRecord> findAllByStatus(PatientRecordStatus status);

        // Search ACTIVE records by name substring — allows staff to find a
        // patient by typing part of first or last name. Case-insensitive.
        @Query("SELECT p FROM PatientRecord p WHERE p.status = 'ACTIVE' "
                        + "AND (LOWER(p.firstName) LIKE LOWER(CONCAT('%', :nameFragment, '%')) "
                        + "OR LOWER(p.lastName) LIKE LOWER(CONCAT('%', :nameFragment, '%')))")
        List<PatientRecord> searchActiveByName(@Param("nameFragment") String nameFragment);

        // Check if a given MRN is already in use (for validation during creation).
        boolean existsByMrn(String mrn);

        // Compliance query: find all ARCHIVED records by the user who archived
        // them (e.g., for auditing "which patient records did this admin
        // archive?"). Never exposes ACTIVE records in results.
        List<PatientRecord> findAllByStatusAndArchivedBy(PatientRecordStatus status, UUID archivedBy);
}
