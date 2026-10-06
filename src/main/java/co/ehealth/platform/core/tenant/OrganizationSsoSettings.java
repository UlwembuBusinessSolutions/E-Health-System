package co.ehealth.platform.core.tenant;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

// Backs the control.organizations.sso_settings JSONB column — same shape
// of precedent as OrganizationMailSettings' own column: a clinic's own IT
// admin registers an application in THEIR Azure AD (Entra ID) tenant and
// pastes its directory id, application (client) id, and a client secret
// here, the same "bring your own account" shape mail settings already
// uses for SMTP. encryptedClientSecret is exactly that — ciphertext from
// core.common.SecretEncryptor, never the raw secret — so a leaked
// database dump alone can't be used to complete Microsoft's OAuth flow as
// this organization.
//
// @JsonIgnoreProperties(ignoreUnknown = true): see OrganizationMailSettings'
// own why-note on isConfigured() — isUsable() below follows the same
// JavaBean "isXxx" getter convention Jackson's default introspector would
// otherwise fold into the stored JSON on every write.
@JsonIgnoreProperties(ignoreUnknown = true)
public record OrganizationSsoSettings(boolean enabled, String microsoftTenantId, String clientId,
                                       String encryptedClientSecret) {

    public static OrganizationSsoSettings empty() {
        return new OrganizationSsoSettings(false, null, null, null);
    }

    // "enabled" alone isn't enough to actually start an OAuth redirect —
    // an admin can flip the switch on before finishing the other three
    // fields (or after clearing one), and a half-configured attempt would
    // either fail against Microsoft or redirect to a client id that no
    // longer resolves. isUsable() is what both the public "show the sign-
    // in button" check (PublicOrganizationController) and the actual
    // /start endpoint (MicrosoftSsoService) gate on — "enabled" alone is
    // only ever read back by the settings form to render the toggle's
    // position.
    @JsonIgnore
    public boolean isUsable() {
        return enabled && isPresent(microsoftTenantId) && isPresent(clientId) && isPresent(encryptedClientSecret);
    }

    private static boolean isPresent(String value) {
        return value != null && !value.isBlank();
    }
}
