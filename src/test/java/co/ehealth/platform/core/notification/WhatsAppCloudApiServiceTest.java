package co.ehealth.platform.core.notification;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.header;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.jsonPath;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

class WhatsAppCloudApiServiceTest {

    @Test
    void sendsApprovedQueueTemplateWithBearerAuthentication() {
        RestClient.Builder builder = RestClient.builder();
        MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
        WhatsAppCloudApiService service = new WhatsAppCloudApiService(builder.build(), "test-token", "phone-id",
                "v26.0", "queue_turn_approaching", "en_US", true);
        server.expect(requestTo("https://graph.facebook.com/v26.0/phone-id/messages"))
                .andExpect(method(HttpMethod.POST))
                .andExpect(header("Authorization", "Bearer test-token"))
                .andExpect(jsonPath("$.messaging_product").value("whatsapp"))
                .andExpect(jsonPath("$.to").value("+27821234567"))
                .andExpect(jsonPath("$.type").value("template"))
                .andExpect(jsonPath("$.template.name").value("queue_turn_approaching"))
                .andExpect(jsonPath("$.template.language.code").value("en_US"))
                .andExpect(jsonPath("$.template.components[0].parameters[0].text").value("2"))
                .andRespond(withSuccess("{\"messages\":[{\"id\":\"wamid.test\"}]}",
                        MediaType.APPLICATION_JSON));

        service.sendApproachingTurn("+27821234567", 2, 18);

        server.verify();
    }

    @Test
    void requiresCredentialsTemplateAndExplicitEnablement() {
        assertTrue(service("token", "phone-id", "queue_turn_approaching", true).isReadyToSend());
        assertFalse(service("", "phone-id", "queue_turn_approaching", true).isReadyToSend());
        assertFalse(service("token", "", "queue_turn_approaching", true).isReadyToSend());
        assertFalse(service("token", "phone-id", "", true).isReadyToSend());
        assertFalse(service("token", "phone-id", "queue_turn_approaching", false).isReadyToSend());
    }

    private WhatsAppCloudApiService service(String accessToken, String phoneNumberId, String templateName,
                                            boolean enabled) {
        return new WhatsAppCloudApiService(RestClient.builder().build(), accessToken, phoneNumberId,
                "v26.0", templateName, "en_US", enabled);
    }
}