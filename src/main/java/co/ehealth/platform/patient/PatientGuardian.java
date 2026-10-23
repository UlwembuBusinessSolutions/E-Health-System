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

// A minor, or any patient travelling with someone who may need to be
// reached or act on their behalf — PatientGuardianService's own cap
// (MAX_GUARDIANS_PER_PATIENT) keeps this a short list, not a general
// contacts book. patientId is a plain column, not a @ManyToOne, same
// lighter-weight style Patient.registeredByUserId and
// PatientDocument.patientId already use.
@Entity
@Table(name = "patient_guardians")
public class PatientGuardian {

    @Id
    @GeneratedValue
    private UUID id;

    @Column(name = "patient_id", nullable = false)
    private UUID patientId;

    @Column(name = "first_name", nullable = false, length = 100)
    private String firstName;

    @Column(name = "last_name", nullable = false, length = 100)
    private String lastName;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private GuardianRelationship relationship;

    @Column(name = "contact_number", nullable = false, length = 20)
    private String contactNumber;

    @Column(name = "id_number", length = 13)
    private String idNumber;

    // Optional — an extra reach channel, not a replacement for contactNumber.
    @Column(length = 255)
    private String email;

    // Never exposed directly — PatientGuardianService.getSignatureUrl() is
    // the only path to the actual file, same reasoning as
    // PatientDocument.s3Key.
    @Column(name = "signature_s3_key", length = 500)
    private String signatureS3Key;

    @Column(name = "consented_at")
    private Instant consentedAt;

    @Column(name = "created_by_user_id")
    private UUID createdByUserId;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    protected PatientGuardian() {
    }

    public PatientGuardian(UUID patientId, String firstName, String lastName, GuardianRelationship relationship,
                            String contactNumber, String idNumber, String email, UUID createdByUserId,
                            Instant createdAt) {
        this.patientId = patientId;
        this.firstName = firstName;
        this.lastName = lastName;
        this.relationship = relationship;
        this.contactNumber = contactNumber;
        this.idNumber = idNumber;
        this.email = email;
        this.createdByUserId = createdByUserId;
        this.createdAt = createdAt;
    }

    public void recordSignature(String signatureS3Key, Instant consentedAt) {
        this.signatureS3Key = signatureS3Key;
        this.consentedAt = consentedAt;
    }

    public UUID getId() {
        return id;
    }

    public UUID getPatientId() {
        return patientId;
    }

    public String getFirstName() {
        return firstName;
    }

    public String getLastName() {
        return lastName;
    }

    public GuardianRelationship getRelationship() {
        return relationship;
    }

    public String getContactNumber() {
        return contactNumber;
    }

    public String getIdNumber() {
        return idNumber;
    }

    public String getEmail() {
        return email;
    }

    public String getSignatureS3Key() {
        return signatureS3Key;
    }

    public Instant getConsentedAt() {
        return consentedAt;
    }

    public UUID getCreatedByUserId() {
        return createdByUserId;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
