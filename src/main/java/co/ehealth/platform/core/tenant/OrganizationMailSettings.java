package co.ehealth.platform.core.tenant;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

// Backs the control.organizations.mail_settings JSONB column — same shape
// of precedent as OrganizationBranding's own column, added specifically so
// EmailService can send outbound mail (account-created, password-reset)
// through a tenant's own SMTP account instead of always the platform-wide
// spring.mail.* one. encryptedPassword is exactly that — ciphertext from
// core.common.SecretEncryptor, never the raw SMTP password — so a leaked
// database dump alone can't be used to send mail as the tenant.
//
// @JsonIgnoreProperties(ignoreUnknown = true): Hibernate's JSON column
// mapper (JacksonJsonFormatMapper) round-trips this record through Jackson
// on every write AND every read — unlike a plain @RequestBody DTO, which
// only ever gets deserialized. A found-the-hard-way bug: isConfigured()
// below follows JavaBean "isXxx" getter convention, so Jackson's default
// introspector serialized it into the stored JSON as a "configured" field
// even though it's not a canonical record component — every write of this
// record wrote one, and every read then failed
// (UnrecognizedPropertyException) because the record's own constructor has
// no such parameter. @JsonIgnore on isConfigured() stops new writes from
// repeating this; ignoreUnknown here is what lets a row already written
// with the stray field (or any other future accidental one) still load.
@JsonIgnoreProperties(ignoreUnknown = true)
public record OrganizationMailSettings(String host, Integer port, String username, String encryptedPassword,
                                        String fromAddress) {

    public static OrganizationMailSettings empty() {
        return new OrganizationMailSettings(null, null, null, null, null);
    }

    // All three are required together — a host with no credentials (or
    // credentials with no host) can't send anything, so "configured" means
    // "usable," not "partially filled in." fromAddress is deliberately
    // excluded: it falls back to app.notifications.from-address when unset
    // (see OrganizationMailSettingsService.resolveForCurrentTenant()).
    @JsonIgnore
    public boolean isConfigured() {
        return isPresent(host) && isPresent(username) && isPresent(encryptedPassword);
    }

    private static boolean isPresent(String value) {
        return value != null && !value.isBlank();
    }
}
