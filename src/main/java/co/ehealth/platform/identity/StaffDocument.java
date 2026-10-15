package co.ehealth.platform.identity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

// PatientDocument's own staff-side counterpart (identity package, not
// patient) — one row per upload, never overwritten (V36's own why-note).
// userId is a plain column, not a @ManyToOne, same lighter-weight style
// PatientDocument.patientId already uses.
@Entity
@Table(name = "staff_documents")
public class StaffDocument {

    @Id
    @GeneratedValue
    private UUID id;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Enumerated(EnumType.STRING)
    @Column(name = "document_type", nullable = false, length = 30)
    private StaffDocumentType documentType;

    @Column(name = "original_filename", nullable = false, length = 255)
    private String originalFilename;

    @Column(name = "content_type", nullable = false, length = 100)
    private String contentType;

    @Column(name = "file_size", nullable = false)
    private long fileSize;

    // Never exposed directly to the frontend — StaffDocumentService hands
    // out a short-lived presigned URL derived from this instead, same
    // reason PatientDocument.getS3Key() has no callers outside its own
    // service.
    @Column(name = "s3_key", nullable = false, length = 500)
    private String s3Key;

    @Column(name = "uploaded_by_user_id")
    private UUID uploadedByUserId;

    @Column(name = "uploaded_at", nullable = false, updatable = false)
    private Instant uploadedAt;

    protected StaffDocument() {
    }

    public StaffDocument(UUID userId, StaffDocumentType documentType, String originalFilename, String contentType,
                          long fileSize, String s3Key, UUID uploadedByUserId, Instant uploadedAt) {
        this.userId = userId;
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

    public UUID getUserId() {
        return userId;
    }

    public StaffDocumentType getDocumentType() {
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
