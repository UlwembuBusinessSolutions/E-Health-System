package co.ehealth.platform.patient;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "patient_registration_verifications")
public class PatientRegistrationVerification {
    @Id
    @GeneratedValue
    private UUID id;

    @Column(name = "first_name", nullable = false, length = 100)
    private String firstName;
    @Column(name = "last_name", nullable = false, length = 100)
    private String lastName;
    @Column(name = "id_number", nullable = false, unique = true, length = 13)
    private String idNumber;
    @Column(nullable = false, length = 300)
    private String address;
    @Column(name = "contact_number", nullable = false, length = 20)
    private String contactNumber;
    @Column(nullable = false, unique = true, length = 255)
    private String email;
    @Column(name = "password_hash", nullable = false, length = 100)
    private String passwordHash;
    @Column(name = "code_hash", nullable = false, length = 100)
    private String codeHash;
    @Column(name = "expires_at", nullable = false)
    private Instant expiresAt;
    @Column(name = "attempt_count", nullable = false)
    private int attemptCount;
    @Column(name = "consumed_at")
    private Instant consumedAt;
    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    protected PatientRegistrationVerification() {}

    public PatientRegistrationVerification(PatientAuthService.RegisterAccountCommand command,
                                            String passwordHash, String codeHash,
                                            Instant expiresAt, Instant createdAt) {
        this.firstName = command.firstName();
        this.lastName = command.lastName();
        this.idNumber = command.idNumber();
        this.address = command.address();
        this.contactNumber = command.contactNumber();
        this.email = command.email();
        this.passwordHash = passwordHash;
        this.codeHash = codeHash;
        this.expiresAt = expiresAt;
        this.createdAt = createdAt;
    }

    public boolean isExpired(Instant now) { return !now.isBefore(expiresAt); }
    public boolean isConsumed() { return consumedAt != null; }
    public void incrementAttempts() { attemptCount++; }
    public void markConsumed(Instant at) { consumedAt = at; }
    public int getAttemptCount() { return attemptCount; }
    public String getCodeHash() { return codeHash; }
    public String getEmail() { return email; }
    public String getFirstName() { return firstName; }
    public String getLastName() { return lastName; }
    public String getIdNumber() { return idNumber; }
    public String getAddress() { return address; }
    public String getContactNumber() { return contactNumber; }
    public String getPasswordHash() { return passwordHash; }
}
