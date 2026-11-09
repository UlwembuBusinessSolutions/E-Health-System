package co.ehealth.platform.core.notification;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import java.util.HashMap;
import java.util.Locale;
import java.util.Map;

/** Optional Meta template-name overrides, keyed by the catalogue's kebab-case IDs. */
@Component
@ConfigurationProperties(prefix = "app.notifications.whatsapp")
public class WhatsAppTemplateProperties {
    private Map<String, String> templateNames = new HashMap<>();

    public Map<String, String> getTemplateNames() {
        return templateNames;
    }

    public void setTemplateNames(Map<String, String> templateNames) {
        this.templateNames = templateNames == null ? new HashMap<>() : templateNames;
    }

    public String nameFor(WhatsAppMessageTemplate template) {
        String key = template.name().toLowerCase(Locale.ROOT).replace('_', '-');
        String configuredName = templateNames.get(key);
        return StringUtils.hasText(configuredName) ? configuredName.trim() : template.templateName();
    }
}
