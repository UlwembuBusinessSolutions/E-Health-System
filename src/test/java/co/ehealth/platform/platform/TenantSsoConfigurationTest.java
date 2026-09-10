package co.ehealth.platform.platform;

import org.junit.jupiter.api.Test;

import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class TenantSsoConfigurationTest {
    @Test
    void doesNotReplaceStoredClientSecretWhenUpdateOmitsIt() {
        TenantSsoConfiguration configuration = new TenantSsoConfiguration(UUID.randomUUID(), SsoProviderType.OIDC);
        configuration.update(true, false, "Admin Staff", "https://issuer", "client", "secret",
                "https://issuer/auth", "https://issuer/token", null, "https://issuer/jwks",
                null, null, null, Map.of());
        configuration.update(true, false, "Admin Staff", "https://issuer", "client", null,
                "https://issuer/auth", "https://issuer/token", null, "https://issuer/jwks",
                null, null, null, Map.of());

        assertThat(configuration.getClientSecret()).isEqualTo("secret");
        assertThat(configuration.isAllowNativeLogin()).isFalse();
    }
}
