package co.ehealth.platform.visit;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
public class QueueApproachDeliveryRecorder {

    private static final Logger log = LoggerFactory.getLogger(QueueApproachDeliveryRecorder.class);

    private final QueueTokenRepository tokens;

    public QueueApproachDeliveryRecorder(QueueTokenRepository tokens) {
        this.tokens = tokens;
    }

    @Transactional
    public void clearFailedWhatsAppAttempt(UUID tokenId) {
        tokens.findById(tokenId).ifPresent(token -> {
            token.clearApproachWhatsAppSent();
            tokens.save(token);
            log.info("Cleared failed WhatsApp attempt for queue token {}; it can be retried", token.getTokenNumber());
        });
    }
}
