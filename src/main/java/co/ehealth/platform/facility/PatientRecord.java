package co.ehealth.platform.facility;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

// Clinical patient record — immutable once created, never physically deleted.
// Compliance requirement (PREG-F04, BR-PREG-150): patient records are the
// legal clinical and audit trail. They must never be destroyed, only withdrawn
// from active use via archiving. Any DELETE attempt (via UI, API, or database)
// is rejected with 403 FORBIDDEN and logged as an audit event.
//
// This entity lives in the tenant schema (each organization has its own patient
// records), not the control schema. TenantContext routes all queries/writes to
// the correct schema for the current request's organization.
@Entity
@Table(name = "patient_records")
public class PatientRecord {

    @Id
    @GeneratedValue
    private UUID id;

    // Medical Record Number — unique within a tenant (organization). Used in
    // place of email for patient identity; patients may not have email at all
    // in some health systems.
    @Column(nullable = false, unique = true, length = 50)
    private String mrn;

    @Column(nullable = false, length = 100)
    private String firstName;

    @Column(nullable = false, length = 100)
    private String lastName;

    @Column(name = "date_of_birth")
    private LocalDate dateOfBirth;

    // ACTIVE | ARCHIVED — never DELETED. The only two allowed states.
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private PatientRecordStatus status;

    // Timestamp when the record entered ARCHIVED state. Null while ACTIVE.
    @Column(name = "archived_at")
    private Instant archivedAt;

    // User ID of the staff member or admin who archived this record. Null
    // while ACTIVE. Recorded so auditors can see who withdrew a record.
    @Column(name = "archived_by")
    private UUID archivedBy;

    // When this record was created. Never updated, immutable.
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    // When this record was last modified. Updated only by archive() and
    // internal field updates (not exposed for direct editing after creation).
    @Column(name = "updated_at")
    private Instant updatedAt;

    // JPA no-arg constructor — required by Jakarta Persistence, never called
    // directly. Only the constructor below (with parameters) is used in
    // application code.
    protected PatientRecord() {
    }

    // Constructor for creating a new patient record. Called by
    // PatientRecordService.createRecord(). Sets status=ACTIVE and createdAt
    // to now; archivedAt/archivedBy remain null until archive() is called.
    public PatientRecord(String mrn, String firstName, String lastName,
            LocalDate dateOfBirth) {
        this.mrn = mrn;
        this.firstName = firstName;
        this.lastName = lastName;
        this.dateOfBirth = dateOfBirth;
        this.status = PatientRecordStatus.ACTIVE;
        this.createdAt = Instant.now();
        this.updatedAt = Instant.now();
    }

    // Business logic: transition from ACTIVE to ARCHIVED state. Sets
    // archivedAt and archivedBy; idempotent (calling twice on the same
    // record is a no-op, won't change timestamps again). Called only by
    // PatientRecordService.archiveRecord(), never directly by controllers.
    public void archive(UUID archiverUserId) {
        if (this.status == PatientRecordStatus.ARCHIVED) {
            return; // Already archived, no-op
        }
        this.status = PatientRecordStatus.ARCHIVED;
        this.archivedAt = Instant.now();
        this.archivedBy = archiverUserId;
        this.updatedAt = Instant.now();
    }

    // --- Getters ---

    public UUID getId() {
        return id;
    }

    public String getMrn() {
        return mrn;
    }

    public String getFirstName() {
        return firstName;
    }

    public String getLastName() {
        return lastName;
    }

    public LocalDate getDateOfBirth() {
        return dateOfBirth;
    }

    public PatientRecordStatus getStatus() {
        return status;
    }

    public Instant getArchivedAt() {
        return archivedAt;
    }

    public UUID getArchivedBy() {
        return archivedBy;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    // --- Limited Setters ---
    // Only minimal setters exposed; most fields are intentionally immutable
    // after creation to enforce the compliance requirement.

    // For updating basic demographic fields only (name, DOB might change).
    // MRN is never updated (it's the stable identifier). Status/timestamps
    // are only changed via archive() method, not direct setters.
    public void setFirstName(String firstName) {
        this.firstName = firstName;
        this.updatedAt = Instant.now();
    }

    public void setLastName(String lastName) {
        this.lastName = lastName;
        this.updatedAt = Instant.now();
    }

    public void setDateOfBirth(LocalDate dateOfBirth) {
        this.dateOfBirth = dateOfBirth;
        this.updatedAt = Instant.now();
    }

    // Internal method used by persistence only — never called from
    // application code. Here to support JPA loading from database.
    protected void setId(UUID id) {
        this.id = id;
    }

    // Internal method — MRN can only be set at creation time, never updated.
    protected void setMrn(String mrn) {
        this.mrn = mrn;
    }

    // Internal method — status and archive tracking are set only via
    // archive() method or by the database, never by direct setter call.
    protected void setStatus(PatientRecordStatus status) {
        this.status = status;
    }

    protected void setArchivedAt(Instant archivedAt) {
        this.archivedAt = archivedAt;
    }

    protected void setArchivedBy(UUID archivedBy) {
        this.archivedBy = archivedBy;
    }

    protected void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }

    protected void setUpdatedAt(Instant updatedAt) {
        this.updatedAt = updatedAt;
    }
}
