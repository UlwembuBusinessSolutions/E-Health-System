package co.ehealth.platform.pharmacy.dispensing;

import co.ehealth.platform.core.common.InvalidFileTypeException;
import co.ehealth.platform.core.tenant.TenantContext;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.NoSuchKeyException;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.util.Set;
import java.util.UUID;

// Keeps the document that proves a third party may collect (a scanned
// written authorisation) in the same object storage as staff documents. The
// object key holds the tenant and the prescription, so a reference only ever
// resolves to a file uploaded for that same prescription.
@Component
public class CollectionProofStorage {

    static final long MAX_BYTES = 10L * 1024 * 1024;
    private static final Set<String> ALLOWED_CONTENT_TYPES = Set.of("application/pdf", "image/jpeg", "image/png");

    public record StoredProof(byte[] content, String contentType) {
    }

    private final S3Client s3Client;
    private final String bucketName;

    public CollectionProofStorage(S3Client s3Client, @Value("${app.storage.bucket-name}") String bucketName) {
        this.s3Client = s3Client;
        this.bucketName = bucketName;
    }

    // Returns the reference to hand back to the client and to send again
    // with the collect request.
    public String store(UUID prescriptionId, MultipartFile file) {
        requireAcceptable(file.getContentType(), file.getSize());
        String reference = ProofReference.newReference();
        try {
            s3Client.putObject(
                    PutObjectRequest.builder().bucket(bucketName).key(keyOf(prescriptionId, reference))
                            .contentType(file.getContentType()).build(),
                    RequestBody.fromInputStream(file.getInputStream(), file.getSize()));
        } catch (IOException e) {
            throw new UncheckedIOException("Failed to read uploaded file", e);
        }
        return reference;
    }

    public StoredProof load(UUID prescriptionId, String proofRef) {
        String reference = ProofReference.requireWellFormed(proofRef);
        try {
            var object = s3Client.getObjectAsBytes(
                    GetObjectRequest.builder().bucket(bucketName).key(keyOf(prescriptionId, reference)).build());
            return new StoredProof(object.asByteArray(), object.response().contentType());
        } catch (NoSuchKeyException missing) {
            throw new CollectionProofNotFoundException();
        }
    }

    static void requireAcceptable(String contentType, long sizeInBytes) {
        if (contentType == null || !ALLOWED_CONTENT_TYPES.contains(contentType)) {
            throw new InvalidFileTypeException("Only PDF, JPEG or PNG files are allowed.");
        }
        if (sizeInBytes <= 0) {
            throw new DispensingValidationException("The file is empty. Choose the document again.");
        }
        if (sizeInBytes > MAX_BYTES) {
            throw new DispensingValidationException("The file is too large. The maximum size is 10 MB.");
        }
    }

    private String keyOf(UUID prescriptionId, String reference) {
        return "collection-proofs/%s/%s/%s".formatted(TenantContext.getCurrentTenant(), prescriptionId, reference);
    }
}
