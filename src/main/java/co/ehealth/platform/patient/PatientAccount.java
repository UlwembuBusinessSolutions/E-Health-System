package co.ehealth.platform.patient;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

// A patient's own portal login — deliberately a separate entity/table from
// Patient, not new columns bolted onto it: Patient is a staff-managed
// clinical record (Patient.java's own why-note — narrow setters, no
// self-service write path anywhere), while this is a self-service
// credential a person controls themselves. Same "third identity space"
// shape as platform.PlatformOperator (its own table, its own lockout
// fields, its own JWT), except tenant-scoped like identity.User rather than
// living in the control schema — a patient only ever exists within one
// tenant's clinic relationship, same as staff.
//
// patientId is always resolved before this row is ever inserted —
// PatientAuthService.register() either finds an existing Patient with a
// matching idNumber (reception already registered this person) or creates
// one on the spot (PatientService.registerSelf()), then constructs this
// entity with that id already in hand. The column stays nullable at the DB
// level as a deliberate margin (a future admin-created account, or a
// looser signup flow, might legitimately need to defer the link) rather
// than because anything today produces an unlinked row. idNumber is stored
// here too (not just resolved through patientId) since it's the same
// matching key Patient itself is keyed on — see PatientAuthService's own
// why-note on the duplicate checks that key off it.
@Entity
@Table(name = "patient_accounts")
public class PatientAccount {

    @Id
    @GeneratedValue
    private UUID id;

    @Column(name = "patient_id")
    private UUID patientId;

    @Column(name = "id_number", nullable = false, unique = true, length = 13)
    private String idNumber;

    @Column(nullable = false, unique = true, length = 255)
    private String email;

    @Column(name = "first_name", nullable = false, length = 100)
    private String firstName;

    @Column(name = "last_name", nullable = false, length = 100)
    private String lastName;

    @Column(name = "password_hash", nullable = false, length = 100)
    private String passwordHash;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private PatientAccountStatus status = PatientAccountStatus.ACTIVE;

    @Column(name = "failed_login_count", nullable = false)
    private int failedLoginCount = 0;

    @Column(name = "last_failed_login_at")
    private Instant lastFailedLoginAt;

    @Column(name = "locked_at")
    private Instant lockedAt;

    @Column(name = "token_version", nullable = false)
    private int tokenVersion = 0;

    @Column(name = "last_login_at")
    private Instant lastLoginAt;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    protected PatientAccount() {
    }

    public PatientAccount(String idNumber, String email, String firstName, String lastName, String passwordHash,
                           UUID patientId, Instant createdAt) {
        this.idNumber = idNumber;
        this.email = email;
        this.firstName = firstName;
        this.lastName = lastName;
        this.passwordHash = passwordHash;
        this.patientId = patientId;
        this.createdAt = createdAt;
    }

    // Same shape and same lockout policy as User/PlatformOperator — see
    // PatientAuthService for where these actually get called.
    public void incrementFailedAttempts() {
        this.failedLoginCount++;
    }

    public void resetFailedAttempts() {
        this.failedLoginCount = 0;
    }

    public void setLastFailedLoginAt(Instant at) {
        this.lastFailedLoginAt = at;
    }

    public void lock(Instant at) {
        this.status = PatientAccountStatus.LOCKED;
        this.lockedAt = at;
    }

    public void unlock() {
        this.status = PatientAccountStatus.ACTIVE;
        this.lockedAt = null;
        this.failedLoginCount = 0;
    }

    public void setLastLoginAt(Instant at) {
        this.lastLoginAt = at;
    }

    public UUID getId() {
        return id;
    }

    public UUID getPatientId() {
        return patientId;
    }

    public String getIdNumber() {
        return idNumber;
    }

    public String getEmail() {
        return email;
    }

    public String getFirstName() {
        return firstName;
    }

    public String getLastName() {
        return lastName;
    }

    public String getPasswordHash() {
        return passwordHash;
    }

    public PatientAccountStatus getStatus() {
        return status;
    }

    public int getFailedLoginCount() {
        return failedLoginCount;
    }

    public Instant getLastFailedLoginAt() {
        return lastFailedLoginAt;
    }

    public Instant getLockedAt() {
        return lockedAt;
    }

    public int getTokenVersion() {
        return tokenVersion;
    }

    public Instant getLastLoginAt() {
        return lastLoginAt;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
