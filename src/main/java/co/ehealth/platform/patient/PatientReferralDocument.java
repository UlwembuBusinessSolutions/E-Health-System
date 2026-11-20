package co.ehealth.platform.patient;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "patient_referral_documents")
public class PatientReferralDocument {

    @Id
    @GeneratedValue
    private UUID id;

    @Column(name = "referral_id", nullable = false)
    private UUID referralId;

    @Column(name = "patient_id", nullable = false)
    private UUID patientId;

    @Column(name = "original_filename", nullable = false, length = 255)
    private String originalFilename;

    @Column(name = "content_type", nullable = false, length = 150)
    private String contentType;

    @Column(name = "file_size", nullable = false)
    private long fileSize;

    @Column(name = "s3_key", nullable = false, unique = true, length = 500)
    private String s3Key;

    @Column(name = "uploaded_by_user_id", nullable = false)
    private UUID uploadedByUserId;

    @Column(name = "uploaded_at", nullable = false)
    private Instant uploadedAt;

    protected PatientReferralDocument() {
    }

    public PatientReferralDocument(UUID referralId, UUID patientId, String originalFilename, String contentType,
                                   long fileSize, String s3Key, UUID uploadedByUserId, Instant uploadedAt) {
        this.referralId = referralId;
        this.patientId = patientId;
        this.originalFilename = originalFilename;
        this.contentType = contentType;
        this.fileSize = fileSize;
        this.s3Key = s3Key;
        this.uploadedByUserId = uploadedByUserId;
        this.uploadedAt = uploadedAt;
    }

    public UUID getId() { return id; }
    public UUID getReferralId() { return referralId; }
    public UUID getPatientId() { return patientId; }
    public String getOriginalFilename() { return originalFilename; }
    public String getContentType() { return contentType; }
    public long getFileSize() { return fileSize; }
    public String getS3Key() { return s3Key; }
    public UUID getUploadedByUserId() { return uploadedByUserId; }
    public Instant getUploadedAt() { return uploadedAt; }
}
