package co.ehealth.platform.core.tenant;

import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class OrganizationSsoSettingsTest {
    @Test void unconfiguredTenantUsesNativeLogin() {
        var settings = OrganizationSsoSettings.empty();
        assertFalse(settings.isUsable());
        assertTrue(settings.allowsNativeLogin());
    }
    @Test void olderMicrosoftConfigurationRetainsCompatibility() {
        var settings = new OrganizationSsoSettings(true, "00000000-0000-0000-0000-000000000000", "client", "encrypted");
        assertTrue(settings.isUsable());
        assertEquals("MICROSOFT", settings.resolvedProvider());
        assertTrue(settings.allowsNativeLogin());
        assertFalse(settings.jitProvisioningEnabled());
    }
    @Test void tenantCanDisableNativeAndEnableSaml() {
        var settings = new OrganizationSsoSettings(true, null, null, null, "SAML", null,
                "https://idp.example.org/entity", "https://idp.example.org/sso", "base64certificate", false,
                true, "example.org");
        assertTrue(settings.isUsable());
        assertFalse(settings.allowsNativeLogin());
    }
}
