package co.ehealth.platform.identity;

import co.ehealth.platform.core.common.InvalidFileTypeException;
import co.ehealth.platform.core.tenant.TenantContext;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.services.s3.presigner.model.GetObjectPresignRequest;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.time.Clock;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.UUID;

// PatientDocumentService's own staff-side counterpart — qualification
// certificates, professional registration proof, ID copies, contracts and
// other HR paperwork. Same "never a permanent public link" reasoning as
// patient documents: this is personal/HR-sensitive material, not a public
// asset the way StaffPhotoService's headshots or OrganizationBrandingService's
// logos are, so getDownloadUrl() below hands out a short-lived presigned
// GET instead of a stored permanent URL.
@Service
public class StaffDocumentService {

    private static final Map<String, String> ALLOWED_CONTENT_TYPES = Map.of(
            "application/pdf", ".pdf",
            "image/jpeg", ".jpg",
            "image/png", ".png",
            "image/webp", ".webp");

    private static final Duration DOWNLOAD_URL_TTL = Duration.ofMinutes(5);

    private final UserRepository userRepository;
    private final StaffDocumentRepository staffDocumentRepository;
    private final S3Client s3Client;
    private final S3Presigner s3Presigner;
    private final String bucketName;
    private final Clock clock;

    public StaffDocumentService(UserRepository userRepository, StaffDocumentRepository staffDocumentRepository,
                                 S3Client s3Client, S3Presigner s3Presigner,
                                 @Value("${app.storage.bucket-name}") String bucketName, Clock clock) {
        this.userRepository = userRepository;
        this.staffDocumentRepository = staffDocumentRepository;
        this.s3Client = s3Client;
        this.s3Presigner = s3Presigner;
        this.bucketName = bucketName;
        this.clock = clock;
    }

    // Permission enforcement lives in StaffController — same /api/v1/admin/**
    // -> ORG_ADMIN matcher every other staff-management endpoint already
    // relies on (StaffController's own why-note), not a second check here.
    @Transactional
    public StaffDocument upload(UUID userId, StaffDocumentType documentType, MultipartFile file,
                                 UUID uploadedByUserId) {
        if (!userRepository.existsById(userId)) {
            throw new IllegalArgumentException("Unknown staff member");
        }
        String extension = ALLOWED_CONTENT_TYPES.get(file.getContentType());
        if (extension == null) {
            throw new InvalidFileTypeException("Only PDF, JPEG, PNG, or WebP files are allowed.");
        }

        // Random, not deterministic like StaffPhotoService's key — a renewed
        // registration certificate or an updated CV is a new row (V36's own
        // why-note), so re-uploading must never overwrite an earlier document
        // still referenced by an existing staff_documents row.
        String key = "staff-documents/%s/%s/%s%s"
                .formatted(TenantContext.getCurrentTenant(), userId, UUID.randomUUID(), extension);

        try {
            s3Client.putObject(
                    PutObjectRequest.builder().bucket(bucketName).key(key)
                            .contentType(file.getContentType()).build(),
                    RequestBody.fromInputStream(file.getInputStream(), file.getSize()));
        } catch (IOException e) {
            throw new UncheckedIOException("Failed to read uploaded file", e);
        }

        String originalFilename = file.getOriginalFilename() != null ? file.getOriginalFilename() : "document";
        StaffDocument document = new StaffDocument(userId, documentType, originalFilename, file.getContentType(),
                file.getSize(), key, uploadedByUserId, clock.instant());
        return staffDocumentRepository.save(document);
    }

    public List<StaffDocument> list(UUID userId) {
        if (!userRepository.existsById(userId)) {
            throw new IllegalArgumentException("Unknown staff member");
        }
        return staffDocumentRepository.findByUserIdOrderByUploadedAtDesc(userId);
    }

    // Never returns s3Key itself or a permanent link — a fresh URL good for
    // DOWNLOAD_URL_TTL, generated on demand, so nothing in the response or
    // an access log stays a valid way to fetch the file past that window.
    public String getDownloadUrl(UUID userId, UUID documentId) {
        StaffDocument document = staffDocumentRepository.findById(documentId)
                .orElseThrow(StaffDocumentNotFoundException::new);
        // Belt-and-braces beyond the schema-per-tenant isolation the
        // {userId} path segment already implies — a documentId that exists
        // but belongs to a different staff member shouldn't resolve either.
        if (!document.getUserId().equals(userId)) {
            throw new StaffDocumentNotFoundException();
        }
        var presignRequest = GetObjectPresignRequest.builder()
                .signatureDuration(DOWNLOAD_URL_TTL)
                .getObjectRequest(GetObjectRequest.builder().bucket(bucketName).key(document.getS3Key()).build())
                .build();
        return s3Presigner.presignGetObject(presignRequest).url().toString();
    }

    // "Remove document" means delete the row and the underlying object —
    // unlike a clinical/ledger record, an HR attachment carries no audit
    // requirement to keep a mistaken upload around forever; the actual
    // qualification data of record lives on User (sancNumber/hpcsaNumber/
    // sapcNumber and their expiry dates), never derived from a scanned
    // file. Idempotent-in-spirit: deleting an already-deleted document 404s
    // via getDownloadUrl()'s same lookup, never a partial delete.
    @Transactional
    public void delete(UUID userId, UUID documentId) {
        StaffDocument document = staffDocumentRepository.findById(documentId)
                .orElseThrow(StaffDocumentNotFoundException::new);
        if (!document.getUserId().equals(userId)) {
            throw new StaffDocumentNotFoundException();
        }
        s3Client.deleteObject(DeleteObjectRequest.builder().bucket(bucketName).key(document.getS3Key()).build());
        staffDocumentRepository.delete(document);
    }
}
