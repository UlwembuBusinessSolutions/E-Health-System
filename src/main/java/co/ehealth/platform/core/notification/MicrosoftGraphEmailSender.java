package co.ehealth.platform.core.notification;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.Duration;
import java.util.Base64;
import java.util.List;
import java.util.Map;

/** Sends application mail through Microsoft Graph using app-only OAuth credentials. */
@Component
class MicrosoftGraphEmailSender {

    private static final String GRAPH_SCOPE = "https://graph.microsoft.com/.default";
    private static final String GRAPH_SEND_MAIL = "https://graph.microsoft.com/v1.0/users/%s/sendMail";
    private static final ClassPathResource LOGO = new ClassPathResource("email/ulwembu-logo.png");

    private final HttpClient httpClient;
    private final ObjectMapper objectMapper;
    private final String tenantId;
    private final String clientId;
    private final String clientSecret;
    private volatile CachedToken cachedToken;

    MicrosoftGraphEmailSender(ObjectMapper objectMapper,
                              @Value("${app.notifications.microsoft-graph.tenant-id:}") String tenantId,
                              @Value("${app.notifications.microsoft-graph.client-id:}") String clientId,
                              @Value("${app.notifications.microsoft-graph.client-secret:}") String clientSecret) {
        this.httpClient = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();
        this.objectMapper = objectMapper;
        this.tenantId = tenantId;
        this.clientId = clientId;
        this.clientSecret = clientSecret;
    }

    void send(String toEmail, String subject, String htmlBody, String fromAddress, String fromName)
            throws IOException, InterruptedException {
        if (blank(tenantId) || blank(clientId) || blank(clientSecret) || blank(fromAddress)) {
            throw new IllegalStateException("Microsoft Graph mail settings are incomplete.");
        }

        String senderPath = URLEncoder.encode(fromAddress, StandardCharsets.UTF_8).replace("+", "%20");
        Map<String, Object> message = Map.of(
                "subject", subject,
                "body", Map.of("contentType", "HTML", "content", htmlBody),
                "from", Map.of("emailAddress", Map.of("name", fromName, "address", fromAddress)),
                "toRecipients", List.of(Map.of("emailAddress", Map.of("address", toEmail))),
                "attachments", List.of(logoAttachment()));
        byte[] payload = objectMapper.writeValueAsBytes(Map.of("message", message, "saveToSentItems", false));
        HttpRequest request = HttpRequest.newBuilder(URI.create(GRAPH_SEND_MAIL.formatted(senderPath)))
                .timeout(Duration.ofSeconds(8))
                .header("Authorization", "Bearer " + accessToken())
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofByteArray(payload))
                .build();
        HttpResponse<Void> response = httpClient.send(request, HttpResponse.BodyHandlers.discarding());
        if (response.statusCode() != 202) {
            throw new IllegalStateException("Microsoft Graph rejected the sendMail request (HTTP "
                    + response.statusCode() + ").");
        }
    }

    private String accessToken() throws IOException, InterruptedException {
        CachedToken current = cachedToken;
        if (current != null && current.expiresAt().isAfter(Instant.now().plusSeconds(60))) {
            return current.value();
        }
        synchronized (this) {
            current = cachedToken;
            if (current != null && current.expiresAt().isAfter(Instant.now().plusSeconds(60))) {
                return current.value();
            }
            String form = "client_id=" + formEncode(clientId)
                    + "&client_secret=" + formEncode(clientSecret)
                    + "&scope=" + formEncode(GRAPH_SCOPE)
                    + "&grant_type=client_credentials";
            URI tokenUri = URI.create("https://login.microsoftonline.com/"
                    + URLEncoder.encode(tenantId, StandardCharsets.UTF_8) + "/oauth2/v2.0/token");
            HttpRequest request = HttpRequest.newBuilder(tokenUri)
                    .timeout(Duration.ofSeconds(8))
                    .header("Content-Type", "application/x-www-form-urlencoded")
                    .POST(HttpRequest.BodyPublishers.ofString(form))
                    .build();
            HttpResponse<String> response = httpClient.send(request,
                    HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                throw new IllegalStateException("Microsoft identity rejected the app token request (HTTP "
                        + response.statusCode() + "). Check the Entra app credentials and consent.");
            }
            JsonNode tokenResponse = objectMapper.readTree(response.body());
            JsonNode token = tokenResponse.get("access_token");
            if (token == null || token.asText().isBlank()) {
                throw new IllegalStateException("Microsoft identity returned no access token.");
            }
            long expiresIn = tokenResponse.path("expires_in").asLong(3600);
            cachedToken = new CachedToken(token.asText(), Instant.now().plusSeconds(expiresIn));
            return cachedToken.value();
        }
    }

    private static Map<String, Object> logoAttachment() throws IOException {
        byte[] bytes;
        try (var input = LOGO.getInputStream()) {
            bytes = input.readAllBytes();
        }
        return Map.of(
                "@odata.type", "#microsoft.graph.fileAttachment",
                "name", "ulwembu-logo.png",
                "contentType", "image/png",
                "contentBytes", Base64.getEncoder().encodeToString(bytes),
                "contentId", EmailDeliveryWorker.LOGO_CONTENT_ID,
                "isInline", true);
    }

    private static String formEncode(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8);
    }

    private static boolean blank(String value) {
        return value == null || value.isBlank();
    }

    private record CachedToken(String value, Instant expiresAt) {}
}
