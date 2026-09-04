package co.ehealth.platform.platform;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

// Deliberately its own identity space, not a User with a special role — a
// platform operator isn't scoped to any tenant, and User's tenant-bound
// fields (facilityId, department, SANC/HPCSA/SAPC...) don't mean anything
// here. Same lockout shape as User by design, though: this account guards
// the ability to create organizations and grant admin access to any of
// them — at least as much protection as a regular staff login, not less.
@Entity
@Table(name = "platform_operators", schema = "control")
public class PlatformOperator {

    @Id
    @GeneratedValue
    private UUID id;

    @Column(nullable = false, unique = true, length = 200)
    private String email;

    @Column(name = "email_verified_at")
    private Instant emailVerifiedAt;

    @Column(name = "first_name", nullable = false, length = 100)
    private String firstName;

    @Column(name = "last_name", nullable = false, length = 100)
    private String lastName;

    @Column(name = "password_hash", nullable = false, length = 100)
    private String passwordHash;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private PlatformOperatorStatus status = PlatformOperatorStatus.ACTIVE;

    @Column(name = "failed_login_count", nullable = false)
    private int failedLoginCount = 0;

    @Column(name = "last_failed_login_at")
    private Instant lastFailedLoginAt;

    // Same meaning as User.lockedAt: when the current LOCKED status
    // started, compared against LOCKOUT_DURATION on the next login
    // attempt to decide whether to auto-unlock. Null whenever status isn't
    // LOCKED.
    @Column(name = "locked_at")
    private Instant lockedAt;

    @Column(name = "token_version", nullable = false)
    private int tokenVersion = 0;

    @Column(name = "last_login_at")
    private Instant lastLoginAt;

    // Set here, not left to the column's own DEFAULT now() — a column
    // default only fires when the INSERT omits the column entirely, and
    // Hibernate includes every mapped field by default, so leaving this
    // unset in Java would insert an explicit NULL and silently shadow the
    // schema's default.
    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    protected PlatformOperator() {
    }

    public PlatformOperator(String email, String firstName, String lastName, String passwordHash) {
        this.email = email;
        this.firstName = firstName;
        this.lastName = lastName;
        this.passwordHash = passwordHash;
        this.emailVerifiedAt = Instant.now();
        this.createdAt = Instant.now();
    }

    // Same shape as User's lockout methods, same policy, applied to a
    // different table — see PlatformAuthService for where these actually
    // get called.
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
        this.status = PlatformOperatorStatus.LOCKED;
        this.lockedAt = at;
    }

    public void unlock() {
        this.status = PlatformOperatorStatus.ACTIVE;
        this.lockedAt = null;
        this.failedLoginCount = 0;
    }

    public void setStatus(PlatformOperatorStatus status) {
        this.status = status;
    }

    public void setLastLoginAt(Instant at) {
        this.lastLoginAt = at;
    }

    // Bumps tokenVersion so a password change invalidates every token
    // already issued — same reasoning as User.setPasswordHash.
    public void setPasswordHash(String hash) {
        this.passwordHash = hash;
        this.tokenVersion++;
    }

    public UUID getId() {
        return id;
    }

    public String getEmail() {
        return email;
    }

    public Instant getEmailVerifiedAt() {
        return emailVerifiedAt;
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

    public PlatformOperatorStatus getStatus() {
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
