package co.ehealth.platform.platform;

import org.junit.jupiter.api.Test;

import java.util.Base64;

import static org.assertj.core.api.Assertions.assertThatThrownBy;

class SamlResponseVerifierTest {
    @Test
    void rejectsUnsignedSamlResponse() {
        String response = Base64.getEncoder().encodeToString("""
                <samlp:Response xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol">
                  <saml:Assertion xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion">
                    <saml:Issuer>https://idp.example.test</saml:Issuer>
                    <saml:Subject><saml:NameID>user-1</saml:NameID></saml:Subject>
                  </saml:Assertion>
                </samlp:Response>
                """.getBytes());

        assertThatThrownBy(() -> new SamlResponseVerifier().verify(response, "not-a-certificate"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("not signed");
    }
}
