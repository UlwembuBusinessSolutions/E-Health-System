package co.ehealth.platform.identity;

import co.ehealth.platform.core.common.InvalidFileTypeException;
import co.ehealth.platform.core.tenant.TenantContext;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.util.Map;
import java.util.UUID;

// Deliberately server-proxied (browser -> this endpoint -> S3), not a
// presigned-URL upload straight from the browser to the bucket. A
// presigned flow avoids running staff photo bytes through the app server
// at all, which matters more at real scale than it does here — noted as a
// follow-up, not built, to keep this to one endpoint instead of two
// ("request an upload URL" + "confirm it landed") plus new CORS
// configuration on the bucket itself.
@Service
public class StaffPhotoService {

    private static final Map<String, String> ALLOWED_CONTENT_TYPES = Map.of(
            "image/jpeg", ".jpg",
            "image/png", ".png",
            "image/webp", ".webp");

    private final UserRepository userRepository;
    private final S3Client s3Client;
    private final String bucketName;
    private final String publicBaseUrl;

    public StaffPhotoService(UserRepository userRepository, S3Client s3Client,
                              @Value("${app.storage.bucket-name}") String bucketName,
                              @Value("${app.storage.public-base-url}") String publicBaseUrl) {
        this.userRepository = userRepository;
        this.s3Client = s3Client;
        this.bucketName = bucketName;
        this.publicBaseUrl = publicBaseUrl;
    }

    @Transactional
    public String uploadPhoto(UUID userId, MultipartFile file) {
        String extension = ALLOWED_CONTENT_TYPES.get(file.getContentType());
        if (extension == null) {
            throw new InvalidFileTypeException("Only JPEG, PNG, or WebP images are allowed.");
        }

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("Unknown staff member"));

        // Deterministic key, not a random one: re-uploading for the same
        // person overwrites the same S3 object instead of leaving the
        // previous file orphaned in the bucket. The one gap this doesn't
        // close: switching file types (a .jpg replaced by a .png) changes
        // the key and does leave the old object behind — acceptable for
        // now, not handled.
        String key = "staff-photos/%s/%s%s".formatted(TenantContext.getCurrentTenant(), userId, extension);

        try {
            s3Client.putObject(
                    PutObjectRequest.builder().bucket(bucketName).key(key)
                            .contentType(file.getContentType()).build(),
                    RequestBody.fromInputStream(file.getInputStream(), file.getSize()));
        } catch (IOException e) {
            throw new UncheckedIOException("Failed to read uploaded file", e);
        }

        String url = publicBaseUrl + "/" + key;
        user.setProfilePhotoUrl(url);
        userRepository.save(user);
        return url;
    }
}
