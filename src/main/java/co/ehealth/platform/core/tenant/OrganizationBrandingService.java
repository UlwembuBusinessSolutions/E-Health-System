package co.ehealth.platform.core.tenant;

import co.ehealth.platform.core.common.InvalidFileTypeException;
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

// Same server-proxied-upload shape as identity.StaffPhotoService, deliberately
// not shared code between the two: the only overlap is "validate a content
// type, put an object in S3, save a URL somewhere" — everything either side
// of that (who's allowed to call it, what the URL gets written onto, what
// the key looks like) is different enough that a shared abstraction would
// mostly be parameter-threading, not real reuse.
//
// Unlike a staff photo, a logo is meant to be public — it's brand identity
// displayed in the UI, not personal data — so no access-control question to
// resolve here the way there might be for other org-level uploads.
@Service
public class OrganizationBrandingService {

    private static final Map<String, String> ALLOWED_CONTENT_TYPES = Map.of(
            "image/jpeg", ".jpg",
            "image/png", ".png",
            "image/webp", ".webp");

    private final OrganizationRepository organizationRepository;
    private final S3Client s3Client;
    private final String bucketName;
    private final String publicBaseUrl;

    public OrganizationBrandingService(OrganizationRepository organizationRepository, S3Client s3Client,
                                        @Value("${app.storage.bucket-name}") String bucketName,
                                        @Value("${app.storage.public-base-url}") String publicBaseUrl) {
        this.organizationRepository = organizationRepository;
        this.s3Client = s3Client;
        this.bucketName = bucketName;
        this.publicBaseUrl = publicBaseUrl;
    }

    @Transactional
    public String uploadLogo(MultipartFile file) {
        String extension = ALLOWED_CONTENT_TYPES.get(file.getContentType());
        if (extension == null) {
            throw new InvalidFileTypeException("Only JPEG, PNG, or WebP images are allowed.");
        }

        // The caller's own org, always — schemaName comes from TenantContext,
        // which TenantFilter only ever sets from a validated X-Tenant-ID +
        // tenant JWT pair (Section 6). There's no path here where this
        // resolves to a different organization than the one the caller
        // authenticated against, so no separate ownership check is needed
        // the way, say, a platform-operator endpoint targeting an arbitrary
        // {id} would need one.
        String schemaName = TenantContext.getCurrentTenant();
        Organization organization = organizationRepository.findBySchemaName(schemaName)
                .orElseThrow(() -> new IllegalStateException("Unknown organization for current tenant"));

        // Deterministic, one per org, same reasoning as StaffPhotoService's
        // key: re-uploading overwrites the previous logo instead of leaving
        // it orphaned in the bucket. Same known gap too — switching file
        // types changes the key and leaves the old object behind.
        String key = "org-logos/%s%s".formatted(schemaName, extension);

        try {
            s3Client.putObject(
                    PutObjectRequest.builder().bucket(bucketName).key(key)
                            .contentType(file.getContentType()).build(),
                    RequestBody.fromInputStream(file.getInputStream(), file.getSize()));
        } catch (IOException e) {
            throw new UncheckedIOException("Failed to read uploaded file", e);
        }

        String url = publicBaseUrl + "/" + key;
        organization.setBranding(organization.getBranding().withLogoUrl(url));
        organizationRepository.save(organization);
        return url;
    }

    // The read half — uploadLogo() above wrote branding for real from the
    // start, but nothing read it back until this existed, which meant a
    // real, persisted upload looked like it had vanished on every page
    // reload. Any authenticated staff member can call this (Section 8's
    // controller puts it outside /api/v1/admin/**, same reasoning as
    // GET /api/v1/facilities) — a logo is meant to be seen by everyone in
    // the org, not just admins; only uploadLogo() is admin-gated.
    public OrganizationBranding getBranding() {
        String schemaName = TenantContext.getCurrentTenant();
        Organization organization = organizationRepository.findBySchemaName(schemaName)
                .orElseThrow(() -> new IllegalStateException("Unknown organization for current tenant"));
        return organization.getBranding();
    }
}
