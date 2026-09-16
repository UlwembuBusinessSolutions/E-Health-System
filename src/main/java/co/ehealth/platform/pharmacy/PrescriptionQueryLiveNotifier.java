package co.ehealth.platform.pharmacy;

import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import java.io.IOException;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

/** In-browser real-time delivery; the notification table remains the reliable inbox. */
@Service
public class PrescriptionQueryLiveNotifier {
    private final Map<UUID, Set<SseEmitter>> subscribers = new ConcurrentHashMap<>();
    public SseEmitter subscribe(UUID userId) {
        SseEmitter emitter = new SseEmitter(0L);
        subscribers.computeIfAbsent(userId, ignored -> ConcurrentHashMap.newKeySet()).add(emitter);
        emitter.onCompletion(() -> remove(userId, emitter));
        emitter.onTimeout(() -> remove(userId, emitter));
        return emitter;
    }
    public void publish(PrescriptionQueryNotification notification) {
        for (SseEmitter emitter : subscribers.getOrDefault(notification.getRecipientUserId(), Set.of())) {
            try { emitter.send(SseEmitter.event().name("prescription-query").data(notification)); }
            catch (IOException ex) { remove(notification.getRecipientUserId(), emitter); }
        }
    }
    private void remove(UUID userId, SseEmitter emitter) {
        Set<SseEmitter> userSubscribers = subscribers.get(userId);
        if (userSubscribers != null) { userSubscribers.remove(emitter); if (userSubscribers.isEmpty()) subscribers.remove(userId, userSubscribers); }
    }
}
