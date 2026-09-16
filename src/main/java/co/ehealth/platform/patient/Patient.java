package co.ehealth.platform.patient;

import co.ehealth.platform.identity.Gender;
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

// PREG-US-001's "PatientEmployee entity" — one row per person registered at
// this tenant, living in that tenant's own schema like every other clinical
// entity (patients belong to exactly one tenant, same isolation boundary as
// users/staff). Still no delete path anywhere in this class or
// PatientRepository — PREG-US-017 ("patient records to be impossible to
// delete through any interface") stays enforced by omission. PREG-US-016
// (update demographics) IS built now, but deliberately narrow: setters
// exist only for the 8 fields below that are genuinely "contact and
// demographic details" a receptionist might need to correct. mpiNumber,
// idNumber, dateOfBirth, gender, and citizenshipStatus have no setter at
// all — mpiNumber per PREG-US-016's own AC2 ("not editable by any role"),
// and the other four because they're derived from idNumber at construction
// (SouthAfricanIdNumber.parse()'s own why-note); letting them drift
// independently of the ID number they were derived from would break that
// invariant. PatientService.update() is the only caller of these setters,
// and only reaches them after PatientFieldHistory has recorded the prior
// value — never call these directly from anywhere else.
@Entity
@Table(name = "patients")
public class Patient {

    @Id
    @GeneratedValue
    private UUID id;

    // Assigned once, at construction, from PatientService's own sequence —
    // never settable again. See PatientService.register()'s own why-note on
    // how uniqueness is guaranteed under concurrent registrations.
    @Column(name = "mpi_number", nullable = false, unique = true, length = 20)
    private String mpiNumber;

    @Column(name = "first_name", nullable = false, length = 100)
    private String firstName;

    @Column(name = "last_name", nullable = false, length = 100)
    private String lastName;

    // Derived from idNumber at registration (SouthAfricanIdNumber.parse()),
    // not taken directly from the request — PREG-US-003's "DOB/gender
    // auto-derived."
    @Column(name = "date_of_birth", nullable = false)
    private LocalDate dateOfBirth;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private Gender gender;

    @Enumerated(EnumType.STRING)
    @Column(name = "citizenship_status", nullable = false, length = 20)
    private CitizenshipStatus citizenshipStatus;

    @Column(name = "id_number", nullable = false, unique = true, length = 13)
    private String idNumber;

    @Column(nullable = false, length = 500)
    private String address;

    @Column(name = "contact_number", nullable = false, length = 20)
    private String contactNumber;

    // Optional — not every patient has one on file, and PREG-US-003 doesn't
    // list it as mandatory. Added for cross-tenant patient migration:
    // PatientMigrationService sends a notification email here when set, and
    // silently skips it otherwise.
    @Column(length = 255)
    private String email;

    // Both nullable — not everyone has medical aid, and PREG-US-003 doesn't
    // list it as mandatory the way name/DOB/ID/address/contact are.
    @Column(name = "medical_aid_provider", length = 100)
    private String medicalAidProvider;

    @Column(name = "medical_aid_number", length = 50)
    private String medicalAidNumber;

    // Supplementary, not an alternative identity path — idNumber stays the
    // required field this class is constructed from; see V15's own
    // migration comment on why this doesn't replace it.
    @Column(name = "passport_number", length = 20)
    private String passportNumber;

    @Column(name = "passport_expiry")
    private LocalDate passportExpiry;

    @Column(name = "registered_by_user_id")
    private UUID registeredByUserId;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    // PREG-US-017 AC2 / PREG-US-018 — archiving, not deleting, is the only
    // way to withdraw a record from active use; there is still no delete
    // method anywhere on this class or PatientRepository. Effectively
    // one-way in every ordinary flow: archive() below has no general-purpose
    // unarchive, same append-only-history philosophy as PatientFieldHistory
    // and PatientDocument elsewhere in this module. reactivateFromMigration()
    // is the one narrow, deliberate exception — see its own why-note.
    @Column(nullable = false)
    private boolean archived = false;

    @Column(name = "archived_reason", columnDefinition = "TEXT")
    private String archivedReason;

    @Column(name = "archived_at")
    private Instant archivedAt;

    @Column(name = "archived_by_user_id")
    private UUID archivedByUserId;

    // Independent of archivedReason's free text — PREG-US-018's own "mark
    // deceased with a date" AC. Nullable: archiving covers reasons other
    // than death (moved away, duplicate record, patient request), which
    // have no date of death to record.
    @Column(name = "deceased_date")
    private LocalDate deceasedDate;

    protected Patient() {
    }

    public Patient(String mpiNumber, String firstName, String lastName, LocalDate dateOfBirth, Gender gender,
                   CitizenshipStatus citizenshipStatus, String idNumber, String address, String contactNumber,
                   String email, String medicalAidProvider, String medicalAidNumber, String passportNumber,
                   LocalDate passportExpiry, UUID registeredByUserId, Instant createdAt) {
        this.mpiNumber = mpiNumber;
        this.firstName = firstName;
        this.lastName = lastName;
        this.dateOfBirth = dateOfBirth;
        this.gender = gender;
        this.citizenshipStatus = citizenshipStatus;
        this.idNumber = idNumber;
        this.address = address;
        this.contactNumber = contactNumber;
        this.email = email;
        this.medicalAidProvider = medicalAidProvider;
        this.medicalAidNumber = medicalAidNumber;
        this.passportNumber = passportNumber;
        this.passportExpiry = passportExpiry;
        this.registeredByUserId = registeredByUserId;
        this.createdAt = createdAt;
    }

    public UUID getId() {
        return id;
    }

    public String getMpiNumber() {
        return mpiNumber;
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

    public Gender getGender() {
        return gender;
    }

    public CitizenshipStatus getCitizenshipStatus() {
        return citizenshipStatus;
    }

    public String getIdNumber() {
        return idNumber;
    }

    public String getAddress() {
        return address;
    }

    public String getContactNumber() {
        return contactNumber;
    }

    public String getEmail() {
        return email;
    }

    public String getMedicalAidProvider() {
        return medicalAidProvider;
    }

    public String getMedicalAidNumber() {
        return medicalAidNumber;
    }

    public String getPassportNumber() {
        return passportNumber;
    }

    public LocalDate getPassportExpiry() {
        return passportExpiry;
    }

    public UUID getRegisteredByUserId() {
        return registeredByUserId;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public boolean isArchived() {
        return archived;
    }

    public String getArchivedReason() {
        return archivedReason;
    }

    public Instant getArchivedAt() {
        return archivedAt;
    }

    public UUID getArchivedByUserId() {
        return archivedByUserId;
    }

    public LocalDate getDeceasedDate() {
        return deceasedDate;
    }

    // PatientService.archive() is the normal caller, same "one entry point,
    // guarded by the service layer" pattern setFirstName() etc. above
    // already follow. PatientMigrationService.migrate() is the one other
    // caller, deliberately not routed through patientService.archive():
    // that method writes a generic "PATIENT_ARCHIVED" audit row, and
    // migration needs its own distinct "PATIENT_MIGRATED_OUT" row instead —
    // calling this directly avoids writing both for the same event.
    public void archive(String reason, LocalDate deceasedDate, UUID archivedByUserId, Instant archivedAt) {
        this.archived = true;
        this.archivedReason = reason;
        this.deceasedDate = deceasedDate;
        this.archivedByUserId = archivedByUserId;
        this.archivedAt = archivedAt;
    }

    // The one narrow exception to this class's otherwise one-way archiving —
    // PatientMigrationWriter.writeDestination()'s "returning patient" path,
    // for when someone migrating IN already has an archived record at this
    // exact tenant under the same idNumber (id_number's own tenant-wide
    // UNIQUE constraint guarantees a match can only be this same person's
    // own earlier record here). The caller only reaches this after
    // confirming — via a patient_migrations row for this record's id — that
    // it was archived specifically BECAUSE this tenant migrated them out
    // before, never for an unrelated reason (deceased, duplicate cleanup):
    // this is not a general-purpose "undo an archive" and must never be
    // exposed as one. mpiNumber/idNumber/dateOfBirth/gender/citizenshipStatus
    // are untouched, same as every other update path on this class — only
    // the archived-state fields clear and the mutable contact/demographic
    // fields refresh from whatever the migration is carrying now (they may
    // have changed while this person was away).
    public void reactivateFromMigration(String firstName, String lastName, String address, String contactNumber,
                                         String email, String medicalAidProvider, String medicalAidNumber,
                                         String passportNumber, LocalDate passportExpiry) {
        this.archived = false;
        this.archivedReason = null;
        this.archivedAt = null;
        this.archivedByUserId = null;
        this.deceasedDate = null;
        this.firstName = firstName;
        this.lastName = lastName;
        this.address = address;
        this.contactNumber = contactNumber;
        this.email = email;
        this.medicalAidProvider = medicalAidProvider;
        this.medicalAidNumber = medicalAidNumber;
        this.passportNumber = passportNumber;
        this.passportExpiry = passportExpiry;
    }

    public void setFirstName(String firstName) {
        this.firstName = firstName;
    }

    public void setLastName(String lastName) {
        this.lastName = lastName;
    }

    public void setAddress(String address) {
        this.address = address;
    }

    public void setContactNumber(String contactNumber) {
        this.contactNumber = contactNumber;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public void setMedicalAidProvider(String medicalAidProvider) {
        this.medicalAidProvider = medicalAidProvider;
    }

    public void setMedicalAidNumber(String medicalAidNumber) {
        this.medicalAidNumber = medicalAidNumber;
    }

    public void setPassportNumber(String passportNumber) {
        this.passportNumber = passportNumber;
    }

    public void setPassportExpiry(LocalDate passportExpiry) {
        this.passportExpiry = passportExpiry;
    }
}
