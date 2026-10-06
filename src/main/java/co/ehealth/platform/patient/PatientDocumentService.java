package co.ehealth.platform.patient;

import co.ehealth.platform.core.common.InvalidFileTypeException;
import co.ehealth.platform.core.tenant.ModuleCode;
import co.ehealth.platform.core.tenant.TenantContext;
import co.ehealth.platform.identity.PermissionLevel;
import co.ehealth.platform.identity.PermissionService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.CopyObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.services.s3.presigner.model.GetObjectPresignRequest;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

// ID copies and medical aid cards carry the same ID number/DOB/address a
// PatientSummary response already treats as sensitive (PatientController's
// own why-note on idNumber) — plus a photo, for an ID copy. Unlike
// StaffPhotoService/OrganizationBrandingService, uploads here never get a
// permanent public-base-url link: getDownloadUrl() below hands out a
// short-lived presigned GET instead, so a leaked/logged URL stops working
// on its own rather than staying valid forever.
@Service
public class PatientDocumentService {

    // webp added alongside PatientDocumentType.PATIENT_PHOTO — PhotoCapture
    // (shared with AddStaffScreen's own webcam-or-upload flow) always offers
    // webp as a pickable file type, and StaffPhotoService's own
    // ALLOWED_CONTENT_TYPES already allows it; without it here, a patient
    // photo picked as a .webp file would 400 with no obvious reason since
    // PhotoCapture's file input doesn't distinguish which upload path it
    // feeds.
    private static final Map<String, String> ALLOWED_CONTENT_TYPES = Map.of(
            "application/pdf", ".pdf",
            "image/jpeg", ".jpg",
            "image/png", ".png",
            "image/webp", ".webp");

    private static final Duration DOWNLOAD_URL_TTL = Duration.ofMinutes(5);

    private final PatientRepository patientRepository;
    private final PatientDocumentRepository patientDocumentRepository;
    private final PermissionService permissionService;
    private final S3Client s3Client;
    private final S3Presigner s3Presigner;
    private final String bucketName;
    private final Clock clock;

    public PatientDocumentService(PatientRepository patientRepository,
                                   PatientDocumentRepository patientDocumentRepository,
                                   PermissionService permissionService, S3Client s3Client, S3Presigner s3Presigner,
                                   @Value("${app.storage.bucket-name}") String bucketName, Clock clock) {
        this.patientRepository = patientRepository;
        this.patientDocumentRepository = patientDocumentRepository;
        this.permissionService = permissionService;
        this.s3Client = s3Client;
        this.s3Presigner = s3Presigner;
        this.bucketName = bucketName;
        this.clock = clock;
    }

    // MANAGE, same level PatientService.register() requires — attaching an
    // identity document to a patient's record is the same class of action
    // as registering them in the first place, not a passive view.
    @Transactional
    public PatientDocument upload(UUID patientId, PatientDocumentType documentType, MultipartFile file,
                                   UUID uploadedByUserId) {
        permissionService.requireAccess(ModuleCode.PREG, PermissionLevel.MANAGE);
        Patient patient = patientRepository.findById(patientId).orElseThrow(PatientNotFoundException::new);
        // PREG-US-018 AC2 ("every edit control is disabled") — attaching a
        // new document is a mutation to the record, same as
        // PatientService.update()'s own guard.
        if (patient.isArchived()) {
            throw new PatientArchivedException();
        }
        String extension = ALLOWED_CONTENT_TYPES.get(file.getContentType());
        if (extension == null) {
            throw new InvalidFileTypeException("Only PDF, JPEG, PNG, or WebP files are allowed.");
        }

        // Random, not deterministic like StaffPhotoService's key — a
        // rescanned ID or renewed medical aid card is a new row (V15's own
        // migration comment), so re-uploading must never overwrite an
        // earlier document still referenced by an existing patient_documents
        // row.
        String key = "patient-documents/%s/%s/%s%s"
                .formatted(TenantContext.getCurrentTenant(), patientId, UUID.randomUUID(), extension);

        try {
            s3Client.putObject(
                    PutObjectRequest.builder().bucket(bucketName).key(key)
                            .contentType(file.getContentType()).build(),
                    RequestBody.fromInputStream(file.getInputStream(), file.getSize()));
        } catch (IOException e) {
            throw new UncheckedIOException("Failed to read uploaded file", e);
        }

        String originalFilename = file.getOriginalFilename() != null ? file.getOriginalFilename() : "document";
        PatientDocument document = new PatientDocument(patientId, documentType, originalFilename,
                file.getContentType(), file.getSize(), key, uploadedByUserId, clock.instant());
        return patientDocumentRepository.save(document);
    }

    public List<PatientDocument> list(UUID patientId) {
        permissionService.requireAccess(ModuleCode.PREG, PermissionLevel.VIEW);
        if (!patientRepository.existsById(patientId)) {
            throw new PatientNotFoundException();
        }
        return patientDocumentRepository.findByPatientIdOrderByUploadedAtDesc(patientId);
    }

    // Never returns s3Key itself or a permanent link — a fresh URL good for
    // DOWNLOAD_URL_TTL, generated on demand rather than stored, so nothing
    // in the response or an access log stays a valid way to fetch the file
    // past that window.
    public String getDownloadUrl(UUID patientId, UUID documentId) {
        permissionService.requireAccess(ModuleCode.PREG, PermissionLevel.VIEW);
        PatientDocument document = patientDocumentRepository.findById(documentId)
                .orElseThrow(PatientDocumentNotFoundException::new);
        // Belt-and-braces beyond the schema-per-tenant isolation the
        // {patientId} path segment already implies — a documentId that
        // exists but belongs to a different patient in this same tenant
        // (wrong link, stale bookmark) shouldn't resolve either.
        if (!document.getPatientId().equals(patientId)) {
            throw new PatientDocumentNotFoundException();
        }
        return presign(document.getS3Key());
    }

    // Extracted from getDownloadUrl() above — PatientMigrationService's
    // destination-view document download needs the exact same presign, but
    // has already resolved and ownership-checked the PatientDocument itself
    // (it's reading it under a TenantContext switched to the destination
    // schema, not this method's own permission/ownership checks, which
    // would be evaluated against the wrong tenant's data if called from
    // there instead).
    String presign(String s3Key) {
        var presignRequest = GetObjectPresignRequest.builder()
                .signatureDuration(DOWNLOAD_URL_TTL)
                .getObjectRequest(GetObjectRequest.builder().bucket(bucketName).key(s3Key).build())
                .build();
        return s3Presigner.presignGetObject(presignRequest).url().toString();
    }

    // Cross-tenant patient migration's document-copy step — PatientMigrationWriter's
    // only caller, called once per document already on the origin record
    // while TenantContext is already switched to the destination schema
    // (PatientMigrationService.migrate()'s own why-note), so the new
    // PatientDocument row this saves lands in the right tenant automatically.
    // Same bucket, same region — a same-region S3-to-S3 copy, no bytes
    // stream through this app. No permission check here, unlike upload()
    // above: this isn't reachable from any controller directly, only from
    // the already-authorized migration flow.
    PatientDocument copyForMigration(PatientDocument original, UUID destinationPatientId, UUID uploadedByUserId,
                                      Instant now) {
        String originalKey = original.getS3Key();
        String extension = originalKey.substring(originalKey.lastIndexOf('.'));
        String newKey = "patient-documents/%s/%s/%s%s"
                .formatted(TenantContext.getCurrentTenant(), destinationPatientId, UUID.randomUUID(), extension);
        s3Client.copyObject(CopyObjectRequest.builder()
                .sourceBucket(bucketName).sourceKey(originalKey)
                .destinationBucket(bucketName).destinationKey(newKey)
                .build());
        PatientDocument copy = new PatientDocument(destinationPatientId, original.getDocumentType(),
                original.getOriginalFilename(), original.getContentType(), original.getFileSize(), newKey,
                uploadedByUserId, now);
        return patientDocumentRepository.save(copy);
    }
}
