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

// One row per upload, not one slot per document_type — V15's own migration
// comment on why a rescanned ID or renewed medical aid card is a new row,
// not an overwrite the way StaffPhotoService's deterministic S3 key is.
// patientId is a plain column, not a @ManyToOne — same lighter-weight style
// Patient.registeredByUserId already uses for a same-tenant-schema
// reference that's never actually navigated as an object graph.
@Entity
@Table(name = "patient_documents")
public class PatientDocument {

    @Id
    @GeneratedValue
    private UUID id;

    @Column(name = "patient_id", nullable = false)
    private UUID patientId;

    @Enumerated(EnumType.STRING)
    @Column(name = "document_type", nullable = false, length = 20)
    private PatientDocumentType documentType;

    @Column(name = "original_filename", nullable = false, length = 255)
    private String originalFilename;

    @Column(name = "content_type", nullable = false, length = 100)
    private String contentType;

    @Column(name = "file_size", nullable = false)
    private long fileSize;

    // Never exposed directly to the frontend — PatientDocumentService hands
    // out a short-lived presigned URL derived from this instead, the same
    // reason this class has no getter callers outside that one service.
    @Column(name = "s3_key", nullable = false, length = 500)
    private String s3Key;

    @Column(name = "uploaded_by_user_id")
    private UUID uploadedByUserId;

    @Column(name = "uploaded_at", nullable = false, updatable = false)
    private Instant uploadedAt;

    protected PatientDocument() {
    }

    public PatientDocument(UUID patientId, PatientDocumentType documentType, String originalFilename,
                            String contentType, long fileSize, String s3Key, UUID uploadedByUserId,
                            Instant uploadedAt) {
        this.patientId = patientId;
        this.documentType = documentType;
        this.originalFilename = originalFilename;
        this.contentType = contentType;
        this.fileSize = fileSize;
        this.s3Key = s3Key;
        this.uploadedByUserId = uploadedByUserId;
        this.uploadedAt = uploadedAt;
    }

    public UUID getId() {
        return id;
    }

    public UUID getPatientId() {
        return patientId;
    }

    public PatientDocumentType getDocumentType() {
        return documentType;
    }

    public String getOriginalFilename() {
        return originalFilename;
    }

    public String getContentType() {
        return contentType;
    }

    public long getFileSize() {
        return fileSize;
    }

    public String getS3Key() {
        return s3Key;
    }

    public UUID getUploadedByUserId() {
        return uploadedByUserId;
    }

    public Instant getUploadedAt() {
        return uploadedAt;
    }
}
