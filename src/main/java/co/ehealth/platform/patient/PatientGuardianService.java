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

// Guardian/companion contacts for a patient — a minor, or anyone travelling
// with someone who may need to be reached or, with a captured signature,
// act on the patient's behalf. Unlike patient_documents (deliberately
// append-only), these are editable-by-deletion: a wrong entry is removed
// and re-added, not amended in place — see remove() below.
@Service
public class PatientGuardianService {

    // A short list of accompanying contacts, not a general contacts book —
    // keeps both the form and this record intentionally bounded.
    private static final int MAX_GUARDIANS_PER_PATIENT = 5;

    private static final Map<String, String> ALLOWED_SIGNATURE_CONTENT_TYPES = Map.of(
            "image/png", ".png",
            "image/jpeg", ".jpg");

    private final PatientRepository patientRepository;
    private final PatientGuardianRepository guardianRepository;
    private final PermissionService permissionService;
    private final S3Client s3Client;
    private final S3Presigner s3Presigner;
    private final String bucketName;
    private final Clock clock;

    public PatientGuardianService(PatientRepository patientRepository, PatientGuardianRepository guardianRepository,
                                   PermissionService permissionService, S3Client s3Client, S3Presigner s3Presigner,
                                   @Value("${app.storage.bucket-name}") String bucketName, Clock clock) {
        this.patientRepository = patientRepository;
        this.guardianRepository = guardianRepository;
        this.permissionService = permissionService;
        this.s3Client = s3Client;
        this.s3Presigner = s3Presigner;
        this.bucketName = bucketName;
        this.clock = clock;
    }

    @Transactional
    public PatientGuardian add(UUID patientId, AddGuardianCommand cmd, UUID createdByUserId) {
        permissionService.requireAccess(ModuleCode.PREG, PermissionLevel.MANAGE);
        requireNotArchived(patientId);
        if (guardianRepository.countByPatientId(patientId) >= MAX_GUARDIANS_PER_PATIENT) {
            throw new TooManyGuardiansException(MAX_GUARDIANS_PER_PATIENT);
        }
        PatientGuardian guardian = new PatientGuardian(patientId, cmd.firstName(), cmd.lastName(),
                cmd.relationship(), cmd.contactNumber(), cmd.idNumber(), cmd.email(), createdByUserId,
                clock.instant());
        return guardianRepository.save(guardian);
    }

    public List<PatientGuardian> list(UUID patientId) {
        permissionService.requireAccess(ModuleCode.PREG, PermissionLevel.VIEW);
        if (!patientRepository.existsById(patientId)) {
            throw new PatientNotFoundException();
        }
        return guardianRepository.findByPatientIdOrderByCreatedAtAsc(patientId);
    }

    // A removal, not an update endpoint — deliberately (class-level
    // why-note). Re-adding after a mistake is one extra form submission;
    // an edit endpoint would be the only mutable field on an otherwise
    // immutable-by-convention set of patient-linked records in this module.
    @Transactional
    public void remove(UUID patientId, UUID guardianId) {
        permissionService.requireAccess(ModuleCode.PREG, PermissionLevel.MANAGE);
        requireNotArchived(patientId);
        PatientGuardian guardian = getOwned(patientId, guardianId);
        guardianRepository.delete(guardian);
    }

    // Consent-to-act capture — a drawn signature (canvas.toBlob("image/png")
    // client-side) or, less commonly, a scanned one. Overwrites any
    // previous signature for this guardian with a deterministic key, unlike
    // PatientDocumentService's own random-key-per-upload: a guardian has
    // exactly one current signature, not a history of past ones worth
    // keeping.
    @Transactional
    public PatientGuardian uploadSignature(UUID patientId, UUID guardianId, MultipartFile file) {
        permissionService.requireAccess(ModuleCode.PREG, PermissionLevel.MANAGE);
        requireNotArchived(patientId);
        PatientGuardian guardian = getOwned(patientId, guardianId);
        String extension = ALLOWED_SIGNATURE_CONTENT_TYPES.get(file.getContentType());
        if (extension == null) {
            throw new InvalidFileTypeException("Only PNG or JPEG signatures are allowed.");
        }

        String key = "patient-guardian-signatures/%s/%s/%s%s"
                .formatted(TenantContext.getCurrentTenant(), patientId, guardianId, extension);
        try {
            s3Client.putObject(
                    PutObjectRequest.builder().bucket(bucketName).key(key)
                            .contentType(file.getContentType()).build(),
                    RequestBody.fromInputStream(file.getInputStream(), file.getSize()));
        } catch (IOException e) {
            throw new UncheckedIOException("Failed to read uploaded file", e);
        }

        guardian.recordSignature(key, clock.instant());
        return guardianRepository.save(guardian);
    }

    private static final Duration SIGNATURE_URL_TTL = Duration.ofMinutes(5);

    public String getSignatureUrl(UUID patientId, UUID guardianId) {
        permissionService.requireAccess(ModuleCode.PREG, PermissionLevel.VIEW);
        PatientGuardian guardian = getOwned(patientId, guardianId);
        if (guardian.getSignatureS3Key() == null) {
            throw new PatientGuardianNotFoundException();
        }
        var presignRequest = GetObjectPresignRequest.builder()
                .signatureDuration(SIGNATURE_URL_TTL)
                .getObjectRequest(GetObjectRequest.builder().bucket(bucketName).key(guardian.getSignatureS3Key()).build())
                .build();
        return s3Presigner.presignGetObject(presignRequest).url().toString();
    }

    // PREG-US-018 AC2 ("every edit control is disabled") — add/remove/
    // uploadSignature() all mutate a guardian attached to this patient, so
    // all three call this before doing anything else.
    private void requireNotArchived(UUID patientId) {
        Patient patient = patientRepository.findById(patientId).orElseThrow(PatientNotFoundException::new);
        if (patient.isArchived()) {
            throw new PatientArchivedException();
        }
    }

    private PatientGuardian getOwned(UUID patientId, UUID guardianId) {
        PatientGuardian guardian = guardianRepository.findById(guardianId)
                .orElseThrow(PatientGuardianNotFoundException::new);
        if (!guardian.getPatientId().equals(patientId)) {
            throw new PatientGuardianNotFoundException();
        }
        return guardian;
    }

    public record AddGuardianCommand(String firstName, String lastName, GuardianRelationship relationship,
                                      String contactNumber, String idNumber, String email) {
    }
}
