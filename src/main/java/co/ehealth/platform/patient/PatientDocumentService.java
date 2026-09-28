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

@Service
public class PatientDocumentService {

    private static final Map<String, String> ALLOWED_CONTENT_TYPES = Map.of(
            "application/pdf", ".pdf",
            "image/jpeg", ".jpg",
            "image/png", ".png",
            "image/webp", ".webp");

    private static final Duration DOWNLOAD_URL_TTL = Duration.ofMinutes(5);

    private final PatientRepository patientRepository;
    private final PatientDocumentRepository patientDocumentRepository;
    private final PermissionService permissionService;
    private final PatientDocumentPdfService pdfService;
    private final S3Client s3Client;
    private final S3Presigner s3Presigner;
    private final String bucketName;
    private final Clock clock;

    public PatientDocumentService(
            PatientRepository patientRepository,
            PatientDocumentRepository patientDocumentRepository,
            PermissionService permissionService,
            PatientDocumentPdfService pdfService,
            S3Client s3Client,
            S3Presigner s3Presigner,
            @Value("${app.storage.bucket-name}") String bucketName,
            Clock clock) {

        this.patientRepository = patientRepository;
        this.patientDocumentRepository = patientDocumentRepository;
        this.permissionService = permissionService;
        this.pdfService = pdfService;
        this.s3Client = s3Client;
        this.s3Presigner = s3Presigner;
        this.bucketName = bucketName;
        this.clock = clock;
    }

    @Transactional
    public PatientDocument upload(
            UUID patientId,
            PatientDocumentType documentType,
            MultipartFile file,
            UUID uploadedByUserId) {

        permissionService.requireAccess(
                ModuleCode.PREG,
                PermissionLevel.MANAGE);

        Patient patient = patientRepository.findById(patientId)
                .orElseThrow(PatientNotFoundException::new);

        if (patient.isArchived()) {
            throw new PatientArchivedException();
        }

        String contentType = file.getContentType();

        if (!ALLOWED_CONTENT_TYPES.containsKey(contentType)) {
            throw new InvalidFileTypeException(
                    "Only PDF, JPEG, PNG, or WebP files are allowed.");
        }

        byte[] originalBytes;

        try {
            originalBytes = file.getBytes();
        } catch (IOException e) {
            throw new UncheckedIOException(
                    "Failed to read uploaded file", e);
        }

        PatientDocumentPdfService.ConversionResult converted =
                pdfService.convert(originalBytes, contentType);

        String key = "patient-documents/%s/%s/%s.pdf"
                .formatted(
                        TenantContext.getCurrentTenant(),
                        patientId,
                        UUID.randomUUID());

        try {
            s3Client.putObject(
                    PutObjectRequest.builder()
                            .bucket(bucketName)
                            .key(key)
                            .contentType("application/pdf")
                            .build(),
                    RequestBody.fromBytes(converted.bytes()));
        } catch (RuntimeException e) {
            throw new IllegalStateException(
                    "Failed to store patient document", e);
        }

        String originalFilename =
                file.getOriginalFilename() != null
                        ? file.getOriginalFilename()
                        : "document";

        PatientDocument document = new PatientDocument(
                patientId,
                documentType,
                originalFilename,
                "application/pdf",
                converted.size(),
                key,
                uploadedByUserId,
                clock.instant());

        return patientDocumentRepository.save(document);
    }

    public List<PatientDocument> list(UUID patientId) {
        permissionService.requireAccess(
                ModuleCode.PREG,
                PermissionLevel.VIEW);

        if (!patientRepository.existsById(patientId)) {
            throw new PatientNotFoundException();
        }

        return patientDocumentRepository
                .findByPatientIdOrderByUploadedAtDesc(patientId);
    }

    public String getDownloadUrl(UUID patientId, UUID documentId) {
        permissionService.requireAccess(
                ModuleCode.PREG,
                PermissionLevel.VIEW);

        PatientDocument document =
                patientDocumentRepository.findById(documentId)
                        .orElseThrow(PatientDocumentNotFoundException::new);

        if (!document.getPatientId().equals(patientId)) {
            throw new PatientDocumentNotFoundException();
        }

        return presign(document.getS3Key());
    }

    String presign(String s3Key) {
        var presignRequest = GetObjectPresignRequest.builder()
                .signatureDuration(DOWNLOAD_URL_TTL)
                .getObjectRequest(
                        GetObjectRequest.builder()
                                .bucket(bucketName)
                                .key(s3Key)
                                .build())
                .build();

        return s3Presigner
                .presignGetObject(presignRequest)
                .url()
                .toString();
    }

    PatientDocument copyForMigration(
            PatientDocument original,
            UUID destinationPatientId,
            UUID uploadedByUserId,
            Instant now) {

        String originalKey = original.getS3Key();

        String extension = originalKey.substring(
                originalKey.lastIndexOf('.'));

        String newKey =
                "patient-documents/%s/%s/%s%s"
                        .formatted(
                                TenantContext.getCurrentTenant(),
                                destinationPatientId,
                                UUID.randomUUID(),
                                extension);

        s3Client.copyObject(
                CopyObjectRequest.builder()
                        .sourceBucket(bucketName)
                        .sourceKey(originalKey)
                        .destinationBucket(bucketName)
                        .destinationKey(newKey)
                        .build());

        PatientDocument copy = new PatientDocument(
                destinationPatientId,
                original.getDocumentType(),
                original.getOriginalFilename(),
                original.getContentType(),
                original.getFileSize(),
                newKey,
                uploadedByUserId,
                now);

        return patientDocumentRepository.save(copy);
    }
}