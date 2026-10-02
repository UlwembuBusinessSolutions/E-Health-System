package co.ehealth.platform.core.tenant;

import co.ehealth.platform.core.common.SecretEncryptor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;

// The tenant-self-service read/write half of OrganizationMailSettings —
// same "resolve the caller's own org from TenantContext" shape as
// OrganizationBrandingService.getOwnOrganization(), reused rather than
// duplicated (see getOwnOrganization() below). Write access is enforced by
// OrganizationMailSettingsController living under /api/v1/admin/** ->
// ORG_ADMIN (SecurityConfig), not by anything in this class.
@Service
public class OrganizationMailSettingsService {

    private final OrganizationRepository organizationRepository;
    private final SecretEncryptor secretEncryptor;

    public OrganizationMailSettingsService(OrganizationRepository organizationRepository,
                                            SecretEncryptor secretEncryptor) {
        this.organizationRepository = organizationRepository;
        this.secretEncryptor = secretEncryptor;
    }

    public OrganizationMailSettings getOwnMailSettings() {
        return getOwnOrganization().getMailSettings();
    }

    @Transactional
    public OrganizationMailSettings updateOwnMailSettings(String host, Integer port, String username,
                                                            String rawPassword, String fromAddress) {
        return applyUpdate(getOwnOrganization(), host, port, username, rawPassword, fromAddress);
    }

    // The platform-operator counterpart to getOwnMailSettings()/
    // updateOwnMailSettings() — same shape as OrganizationBrandingService's
    // own uploadLogo()/uploadLogoForOrganization() split: this one takes an
    // already-resolved Organization instead of reading TenantContext, since
    // OrganizationProvisioningService's platform-console callers act on an
    // arbitrary {id} passed by the caller, not their own tenant (there's no
    // tenant session to resolve one from — a platform operator isn't a
    // tenant login at all).
    public OrganizationMailSettings getMailSettingsForOrganization(Organization organization) {
        return organization.getMailSettings();
    }

    @Transactional
    public OrganizationMailSettings updateMailSettingsForOrganization(Organization organization, String host,
                                                                        Integer port, String username,
                                                                        String rawPassword, String fromAddress) {
        return applyUpdate(organization, host, port, username, rawPassword, fromAddress);
    }

    // A blank password means "leave the stored one alone" — neither GET
    // side ever returns the decrypted password (both controllers only ever
    // expose a passwordSet boolean, same reasoning as User.passwordHash
    // never being serialized), so neither edit form has a way to round-trip
    // it and both always submit it blank unless someone is actually typing
    // a new one.
    private OrganizationMailSettings applyUpdate(Organization organization, String host, Integer port,
                                                   String username, String rawPassword, String fromAddress) {
        String encryptedPassword = (rawPassword == null || rawPassword.isBlank())
                ? organization.getMailSettings().encryptedPassword()
                : secretEncryptor.encrypt(rawPassword);
        OrganizationMailSettings updated = new OrganizationMailSettings(
                blankToNull(host), port, blankToNull(username), encryptedPassword, blankToNull(fromAddress));
        organization.setMailSettings(updated);
        organizationRepository.save(organization);
        return updated;
    }

    // Consumed by EmailService to decide whether to send through this
    // tenant's own SMTP account instead of the platform-wide
    // spring.mail.* default. Empty when there's no current tenant (a
    // platform-operator email, e.g. PlatformOperatorService, never runs
    // inside TenantContext) or the tenant hasn't finished configuring its
    // own settings (OrganizationMailSettings.isConfigured()) — either way,
    // the caller falls back to the app-wide default, same as before this
    // feature existed.
    public Optional<MailCredentials> resolveForCurrentTenant() {
        String schemaName = TenantContext.getCurrentTenant();
        if (schemaName == null) {
            return Optional.empty();
        }
        return organizationRepository.findBySchemaName(schemaName)
                .map(Organization::getMailSettings)
                .filter(OrganizationMailSettings::isConfigured)
                .map(settings -> new MailCredentials(
                        settings.host(),
                        settings.port() != null ? settings.port() : 587,
                        settings.username(),
                        secretEncryptor.decrypt(settings.encryptedPassword()),
                        settings.fromAddress()));
    }

    private Organization getOwnOrganization() {
        String schemaName = TenantContext.getCurrentTenant();
        return organizationRepository.findBySchemaName(schemaName)
                .orElseThrow(() -> new IllegalStateException("Unknown organization for current tenant"));
    }

    private static String blankToNull(String value) {
        return (value == null || value.isBlank()) ? null : value;
    }

    // Plaintext-decrypted credentials, held only long enough for
    // EmailService to hand them to EmailDeliveryWorker on the request
    // thread — never logged, never returned from a controller.
    public record MailCredentials(String host, int port, String username, String password, String fromAddress) {
    }
}
