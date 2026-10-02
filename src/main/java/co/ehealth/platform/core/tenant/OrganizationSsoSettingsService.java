package co.ehealth.platform.core.tenant;

import co.ehealth.platform.core.common.SecretEncryptor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

// The tenant-self-service read/write half of OrganizationSsoSettings —
// same "resolve the caller's own org from TenantContext" shape as
// OrganizationMailSettingsService. Write access is enforced by
// OrganizationSsoSettingsController living under /api/v1/admin/** ->
// ORG_ADMIN (SecurityConfig), not by anything in this class.
@Service
public class OrganizationSsoSettingsService {

    private final OrganizationRepository organizationRepository;
    private final SecretEncryptor secretEncryptor;

    public OrganizationSsoSettingsService(OrganizationRepository organizationRepository,
                                           SecretEncryptor secretEncryptor) {
        this.organizationRepository = organizationRepository;
        this.secretEncryptor = secretEncryptor;
    }

    public OrganizationSsoSettings getOwnSsoSettings() {
        return getOwnOrganization().getSsoSettings();
    }

    // A blank client secret means "leave the stored one alone" — same
    // reasoning as OrganizationMailSettingsService.applyUpdate()'s own
    // why-note on the mail password: the GET side never returns the
    // decrypted secret, so the edit form has no way to round-trip it and
    // always submits it blank unless someone is actually typing a new one.
    @Transactional
    public OrganizationSsoSettings updateOwnSsoSettings(boolean enabled, String microsoftTenantId, String clientId,
                                                          String rawClientSecret) {
        Organization organization = getOwnOrganization();
        String encryptedClientSecret = (rawClientSecret == null || rawClientSecret.isBlank())
                ? organization.getSsoSettings().encryptedClientSecret()
                : secretEncryptor.encrypt(rawClientSecret);
        OrganizationSsoSettings updated = new OrganizationSsoSettings(
                enabled, blankToNull(microsoftTenantId), blankToNull(clientId), encryptedClientSecret);
        organization.setSsoSettings(updated);
        organizationRepository.save(organization);
        return updated;
    }

    private Organization getOwnOrganization() {
        String schemaName = TenantContext.getCurrentTenant();
        return organizationRepository.findBySchemaName(schemaName)
                .orElseThrow(() -> new IllegalStateException("Unknown organization for current tenant"));
    }

    private static String blankToNull(String value) {
        return (value == null || value.isBlank()) ? null : value;
    }
}
