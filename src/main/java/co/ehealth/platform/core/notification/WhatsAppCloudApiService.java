package co.ehealth.platform.core.notification;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import jakarta.annotation.PostConstruct;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestClient;

import java.util.List;
import java.util.Map;
import java.util.LinkedHashMap;
import java.util.concurrent.CompletableFuture;

@Service
public class WhatsAppCloudApiService {

    private static final Logger log = LoggerFactory.getLogger(WhatsAppCloudApiService.class);
    private static final String GRAPH_API_URL = "https://graph.facebook.com";

    private final RestClient restClient;
    private final String accessToken;
    private final String phoneNumberId;
    private final String apiVersion;
    private final String templateName;
    private final String templateLanguage;
    private final boolean whatsappEnabled;

    @Autowired(required = false)
    private WhatsAppTemplateProperties templateProperties;

    @Autowired
    public WhatsAppCloudApiService(RestClient.Builder restClientBuilder,
                                   @Value("${app.notifications.whatsapp.access-token:}") String accessToken,
                                   @Value("${app.notifications.whatsapp.phone-number-id:}") String phoneNumberId,
                                   @Value("${app.notifications.whatsapp.api-version:v26.0}") String apiVersion,
                                   @Value("${app.notifications.whatsapp.queue-template-name:}") String templateName,
                                   @Value("${app.notifications.whatsapp.template-language:en_US}") String templateLanguage,
                                   @Value("${app.notifications.whatsapp.enabled:false}") boolean whatsappEnabled) {
        this(restClientBuilder.build(), accessToken, phoneNumberId, apiVersion, templateName,
                templateLanguage, whatsappEnabled);
    }

    WhatsAppCloudApiService(RestClient restClient, String accessToken, String phoneNumberId, String apiVersion,
                            String templateName, String templateLanguage, boolean whatsappEnabled) {
        this.restClient = restClient;
        this.accessToken = accessToken;
        this.phoneNumberId = phoneNumberId;
        this.apiVersion = apiVersion;
        this.templateName = templateName;
        this.templateLanguage = templateLanguage;
        this.whatsappEnabled = whatsappEnabled;
    }

    public boolean isReadyToSend() {
        return whatsappEnabled && StringUtils.hasText(accessToken) && StringUtils.hasText(phoneNumberId)
                && StringUtils.hasText(apiVersion) && StringUtils.hasText(templateName)
                && StringUtils.hasText(templateLanguage);
    }

    private boolean isCloudApiReady() {
        return whatsappEnabled && StringUtils.hasText(accessToken) && StringUtils.hasText(phoneNumberId)
                && StringUtils.hasText(apiVersion) && StringUtils.hasText(templateLanguage);
    }

    @PostConstruct
    void logConfigurationStatus() {
        if (isCloudApiReady()) {
            log.info("WhatsApp Cloud API is enabled and configured; queue-template-configured={}",
                    StringUtils.hasText(templateName));
        } else {
            log.warn("WhatsApp Cloud API is unavailable: enabled={}, accessTokenPresent={}, "
                    + "phoneNumberIdPresent={}, apiVersionPresent={}, languagePresent={}",
                    whatsappEnabled, StringUtils.hasText(accessToken), StringUtils.hasText(phoneNumberId),
                    StringUtils.hasText(apiVersion), StringUtils.hasText(templateLanguage));
        }
    }

    @Async("smsTaskExecutor")
    public CompletableFuture<Boolean> sendApproachingTurn(String phoneNumber, int tokensAhead, int tokenNumber) {
        if (!isReadyToSend()) {
            return CompletableFuture.completedFuture(false);
        }
        return sendTemplateNow(phoneNumber, templateName, templateLanguage, List.of(Integer.toString(tokensAhead)),
                "queue token " + tokenNumber, false);
    }

    /** Sends a catalogue template using its declared named dynamic values. */
    @Async("smsTaskExecutor")
    public CompletableFuture<Boolean> sendTemplate(String phoneNumber, WhatsAppMessageTemplate messageTemplate,
                                                   Map<String, String> values, String reference) {
        if (!isCloudApiReady()) {
            return CompletableFuture.completedFuture(false);
        }
        List<String> parameters = new java.util.ArrayList<>();
        for (String field : messageTemplate.parameters()) {
            String value = values == null ? null : values.get(field);
            if (!StringUtils.hasText(value)) {
                log.warn("WhatsApp template {} was not sent: required value '{}' is missing (reference {})",
                        messageTemplate.templateName(), field, reference);
                return CompletableFuture.completedFuture(false);
            }
            if (messageTemplate.authentication() && value.length() > 15) {
                log.warn("WhatsApp authentication code for template {} exceeds 15 characters (reference {})",
                        messageTemplate.templateName(), reference);
                return CompletableFuture.completedFuture(false);
            }
            parameters.add(value);
        }
        String resolvedTemplateName = templateProperties == null
                ? messageTemplate.templateName() : templateProperties.nameFor(messageTemplate);
        return sendTemplateNow(phoneNumber, resolvedTemplateName, templateLanguage, parameters,
                messageTemplate.name() + " reference " + reference, messageTemplate.authentication());
    }

    private CompletableFuture<Boolean> sendTemplateNow(String phoneNumber, String name, String language,
                                                        List<String> values, String reference, boolean authentication) {
        List<Map<String, Object>> bodyParameters = values.stream()
                .map(value -> Map.<String, Object>of("type", "text", "text", value)).toList();
        Map<String, Object> bodyComponent = Map.of("type", "body", "parameters", bodyParameters);
        List<Map<String, Object>> components = new java.util.ArrayList<>();
        components.add(bodyComponent);
        if (authentication && !values.isEmpty()) {
            Map<String, Object> buttonParameter = Map.of("type", "text", "text", values.get(0));
            components.add(Map.of("type", "button", "sub_type", "url", "index", "0",
                    "parameters", List.of(buttonParameter)));
        }
        Map<String, Object> template = Map.of("name", name, "language", Map.of("code", language),
                "components", components);
        Map<String, Object> request = new LinkedHashMap<>();
        request.put("messaging_product", "whatsapp");
        request.put("recipient_type", "individual");
        request.put("to", phoneNumber);
        request.put("type", "template");
        request.put("template", template);
        String endpoint = GRAPH_API_URL + "/" + apiVersion + "/" + phoneNumberId + "/messages";
        try {
            Map<String, Object> response = restClient.post()
                    .uri(endpoint)
                    .headers(headers -> headers.setBearerAuth(accessToken))
                    .body(request)
                    .retrieve()
                    .body(new ParameterizedTypeReference<>() { });
            if (response == null) {
                log.warn("WhatsApp Cloud API returned an empty response for {}", reference);
                return CompletableFuture.completedFuture(false);
            }
            log.info("WhatsApp Cloud API accepted template {} for {}", name, reference);
            return CompletableFuture.completedFuture(true);
        } catch (RuntimeException ex) {
            log.warn("WhatsApp Cloud API failed to accept template {} for {}", name, reference, ex);
            return CompletableFuture.completedFuture(false);
        }
    }
}
