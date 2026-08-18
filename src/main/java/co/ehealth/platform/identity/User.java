package co.ehealth.platform.identity;

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

@Entity
@Table(name = "users")
public class User {

    @Id
    @GeneratedValue
    private UUID id;

    @Column(name = "employee_number", nullable = false, unique = true, length = 30)
    private String employeeNumber;

    // Nullable, unique-when-present — a foreign national on a work permit
    // wouldn't have a South African national ID at all.
    @Column(name = "id_number", unique = true, length = 13)
    private String idNumber;

    @Column(nullable = false, unique = true, length = 200)
    private String email;

    @Column(name = "first_name", nullable = false, length = 100)
    private String firstName;

    @Column(name = "last_name", nullable = false, length = 100)
    private String lastName;

    @Column(name = "contact_number", nullable = false, unique = true, length = 20)
    private String contactNumber;

    @Column(name = "password_hash", nullable = false, length = 100)
    private String passwordHash;

    // True from creation until the staff member changes it themselves —
    // set once by StaffService (admin-entered temp password), cleared the
    // next time setPasswordHash runs for any reason.
    @Column(name = "must_change_password", nullable = false)
    private boolean mustChangePassword = true;

    @Column(name = "facility_id")
    private UUID facilityId;

    @Column(name = "employment_start_date")
    private LocalDate employmentStartDate;

    @Column(name = "employment_end_date")
    private LocalDate employmentEndDate;

    // A reference into blob storage, not image bytes.
    @Column(name = "profile_photo_url", length = 500)
    private String profilePhotoUrl;

    @Enumerated(EnumType.STRING)
    @Column(name = "employment_type", length = 30)
    private EmploymentType employmentType;

    @Column(name = "emergency_contact_name", length = 200)
    private String emergencyContactName;

    @Column(name = "emergency_contact_relationship", length = 50)
    private String emergencyContactRelationship;

    @Column(name = "emergency_contact_phone", length = 20)
    private String emergencyContactPhone;

    // Who this person reports to — another row in this same table. Nothing
    // reads it yet (no org-chart or "my direct reports" view); it's
    // captured now so StaffService has somewhere to put it at creation
    // time rather than bolting it on later.
    @Column(name = "manager_id")
    private UUID managerId;

    @Column(length = 100)
    private String department;

    @Column(length = 100)
    private String designation;

    @Column(name = "date_of_birth")
    private LocalDate dateOfBirth;

    @Enumerated(EnumType.STRING)
    @Column(length = 10)
    private Gender gender;

    // Nullable, UNIQUE-when-present. Which of the three a given staff
    // member has is a role-driven UI concern; neither this entity nor the
    // schema enforces "doctors need HPCSA."
    @Column(name = "sanc_number", length = 30)
    private String sancNumber;

    @Column(name = "sanc_expiry_date")
    private LocalDate sancExpiryDate;

    @Column(name = "hpcsa_number", length = 30)
    private String hpcsaNumber;

    @Column(name = "hpcsa_expiry_date")
    private LocalDate hpcsaExpiryDate;

    @Column(name = "sapc_number", length = 30)
    private String sapcNumber;

    @Column(name = "sapc_expiry_date")
    private LocalDate sapcExpiryDate;

    @Column(name = "email_verified_at")
    private Instant emailVerifiedAt;

    @Column(name = "contact_verified_at")
    private Instant contactVerifiedAt;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private UserStatus status = UserStatus.ACTIVE;

    @Column(name = "failed_login_count", nullable = false)
    private int failedLoginCount = 0;

    @Column(name = "last_failed_login_at")
    private Instant lastFailedLoginAt;

    // When the current LOCKED status started. AuthService compares this
    // against LOCKOUT_DURATION on the next login attempt to decide whether
    // to auto-unlock — null whenever status isn't LOCKED.
    @Column(name = "locked_at")
    private Instant lockedAt;

    @Column(name = "token_version", nullable = false)
    private int tokenVersion = 0;

    @Column(name = "last_login_at")
    private Instant lastLoginAt;

    protected User() {
    }

    public User(String employeeNumber, String email, String firstName, String lastName,
                String contactNumber, String passwordHash, UUID facilityId, Gender gender) {
        this.employeeNumber = employeeNumber;
        this.email = email;
        this.firstName = firstName;
        this.lastName = lastName;
        this.contactNumber = contactNumber;
        this.passwordHash = passwordHash;
        this.facilityId = facilityId;
        this.gender = gender;
    }

    // Optional profile fields set individually after construction rather
    // than widening the constructor further — StaffService only calls the
    // ones it actually received a value for.
    public void setIdNumber(String idNumber) {
        this.idNumber = idNumber;
    }

    public void setEmploymentStartDate(LocalDate employmentStartDate) {
        this.employmentStartDate = employmentStartDate;
    }

    public void setEmploymentEndDate(LocalDate employmentEndDate) {
        this.employmentEndDate = employmentEndDate;
    }

    public void setProfilePhotoUrl(String profilePhotoUrl) {
        this.profilePhotoUrl = profilePhotoUrl;
    }

    public void setEmploymentType(EmploymentType employmentType) {
        this.employmentType = employmentType;
    }

    public void setEmergencyContactName(String emergencyContactName) {
        this.emergencyContactName = emergencyContactName;
    }

    public void setEmergencyContactRelationship(String relationship) {
        this.emergencyContactRelationship = relationship;
    }

    public void setEmergencyContactPhone(String emergencyContactPhone) {
        this.emergencyContactPhone = emergencyContactPhone;
    }

    public void setManagerId(UUID managerId) {
        this.managerId = managerId;
    }

    public void setDepartment(String department) {
        this.department = department;
    }

    public void setDesignation(String designation) {
        this.designation = designation;
    }

    public void setDateOfBirth(LocalDate dateOfBirth) {
        this.dateOfBirth = dateOfBirth;
    }

    public void setSancNumber(String sancNumber) {
        this.sancNumber = sancNumber;
    }

    public void setSancExpiryDate(LocalDate sancExpiryDate) {
        this.sancExpiryDate = sancExpiryDate;
    }

    public void setHpcsaNumber(String hpcsaNumber) {
        this.hpcsaNumber = hpcsaNumber;
    }

    public void setHpcsaExpiryDate(LocalDate hpcsaExpiryDate) {
        this.hpcsaExpiryDate = hpcsaExpiryDate;
    }

    public void setSapcNumber(String sapcNumber) {
        this.sapcNumber = sapcNumber;
    }

    public void setSapcExpiryDate(LocalDate sapcExpiryDate) {
        this.sapcExpiryDate = sapcExpiryDate;
    }

    public void markEmailVerified(Instant at) {
        this.emailVerifiedAt = at;
    }

    public void markContactVerified(Instant at) {
        this.contactVerifiedAt = at;
    }

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
        this.status = UserStatus.LOCKED;
        this.lockedAt = at;
    }

    // Called both when the lockout window has naturally expired (login
    // retried after LOCKOUT_DURATION) and when an admin force-unlocks —
    // either way, failed-attempt history shouldn't carry over.
    public void unlock() {
        this.status = UserStatus.ACTIVE;
        this.lockedAt = null;
        this.failedLoginCount = 0;
    }

    public void setStatus(UserStatus status) {
        this.status = status;
    }

    public void setLastLoginAt(Instant at) {
        this.lastLoginAt = at;
    }

    // Bumping tokenVersion here — not just from the password-reset flow —
    // means every path that changes a password invalidates existing JWTs
    // for free. Also clears mustChangePassword: the only caller that sets
    // an admin-chosen password is the constructor above, so any call here
    // by definition represents the staff member setting their own.
    public void setPasswordHash(String hash) {
        this.passwordHash = hash;
        this.tokenVersion++;
        this.mustChangePassword = false;
    }

    public UUID getId() {
        return id;
    }

    public String getEmployeeNumber() {
        return employeeNumber;
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

    public String getContactNumber() {
        return contactNumber;
    }

    public String getPasswordHash() {
        return passwordHash;
    }

    public boolean isMustChangePassword() {
        return mustChangePassword;
    }

    public UUID getFacilityId() {
        return facilityId;
    }

    public LocalDate getEmploymentStartDate() {
        return employmentStartDate;
    }

    public LocalDate getEmploymentEndDate() {
        return employmentEndDate;
    }

    public String getProfilePhotoUrl() {
        return profilePhotoUrl;
    }

    public EmploymentType getEmploymentType() {
        return employmentType;
    }

    public String getEmergencyContactName() {
        return emergencyContactName;
    }

    public String getEmergencyContactRelationship() {
        return emergencyContactRelationship;
    }

    public String getEmergencyContactPhone() {
        return emergencyContactPhone;
    }

    public UUID getManagerId() {
        return managerId;
    }

    public String getDepartment() {
        return department;
    }

    public String getDesignation() {
        return designation;
    }

    public LocalDate getDateOfBirth() {
        return dateOfBirth;
    }

    public Gender getGender() {
        return gender;
    }

    public String getSancNumber() {
        return sancNumber;
    }

    public LocalDate getSancExpiryDate() {
        return sancExpiryDate;
    }

    public String getHpcsaNumber() {
        return hpcsaNumber;
    }

    public LocalDate getHpcsaExpiryDate() {
        return hpcsaExpiryDate;
    }

    public String getSapcNumber() {
        return sapcNumber;
    }

    public LocalDate getSapcExpiryDate() {
        return sapcExpiryDate;
    }

    public Instant getEmailVerifiedAt() {
        return emailVerifiedAt;
    }

    public Instant getContactVerifiedAt() {
        return contactVerifiedAt;
    }

    public UserStatus getStatus() {
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
}
