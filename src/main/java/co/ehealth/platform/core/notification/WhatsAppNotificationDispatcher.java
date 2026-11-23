package co.ehealth.platform.core.notification;

import co.ehealth.platform.patient.Patient;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.function.BiConsumer;
import java.util.regex.Pattern;

/** Applies consent and transaction timing consistently to patient templates. */
@Service
public class WhatsAppNotificationDispatcher {
    private static final Logger log = LoggerFactory.getLogger(WhatsAppNotificationDispatcher.class);
    private static final Pattern E164 = Pattern.compile("^\\+[1-9][0-9]{7,14}$");

    private final WhatsAppCloudApiService cloudApi;

    public WhatsAppNotificationDispatcher(WhatsAppCloudApiService cloudApi) {
        this.cloudApi = cloudApi;
    }

    public void sendPatientAfterCommit(Patient patient, WhatsAppMessageTemplate template,
                                       Map<String, String> values, String reference) {
        sendPatientAfterCommit(patient, template, values, reference, null);
    }

    public void sendPatientAfterCommit(Patient patient, WhatsAppMessageTemplate template,
                                       Map<String, String> values, String reference,
                                       BiConsumer<Boolean, Throwable> completion) {
        if (patient == null || !patient.isWhatsAppOptedIn()) {
            return;
        }
        String phone = toE164(patient.getContactNumber());
        if (phone == null) {
            log.debug("Skipping WhatsApp template {} for reference {}: invalid mobile number",
                    template.templateName(), reference);
            return;
        }
        // Preserve missing/null fields so the sender can report the specific
        // required template parameter instead of Map.copyOf throwing here.
        Map<String, String> safeValues = values == null
                ? Map.of() : Collections.unmodifiableMap(new LinkedHashMap<>(values));
        Runnable send = () -> {
            try {
                CompletableFuture<Boolean> delivery = cloudApi.sendTemplate(phone, template, safeValues, reference);
                if (completion != null) delivery.whenComplete(completion);
            } catch (RuntimeException ex) {
                if (completion != null) completion.accept(false, ex);
                throw ex;
            }
        };
        if (TransactionSynchronizationManager.isSynchronizationActive()
                && TransactionSynchronizationManager.isActualTransactionActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    try {
                        send.run();
                    } catch (RuntimeException ex) {
                        log.warn("Could not queue WhatsApp template {} for reference {}",
                                template.templateName(), reference, ex);
                    }
                }
            });
        } else {
            send.run();
        }
    }

    public static String toE164(String number) {
        if (number == null || number.isBlank()) return null;
        String compact = number.trim().replaceAll("[\\s()-]", "");
        if (compact.startsWith("+")) {
            if (!E164.matcher(compact).matches()) return null;
            return compact.startsWith("+27") && !compact.matches("\\+27[6-8][0-9]{8}") ? null : compact;
        }
        if (compact.matches("0[6-8][0-9]{8}")) return "+27" + compact.substring(1);
        if (compact.matches("27[6-8][0-9]{8}")) return "+" + compact;
        return null;
    }
}
