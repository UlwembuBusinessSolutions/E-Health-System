package co.ehealth.platform.core.security;

import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

// In-memory: fine for one instance. Behind a load balancer with more than
// one, a user's idle clock must be visible to every instance — swap this
// for a Redis-backed implementation with the same interface before scaling
// horizontally; not needed for Phase 1.
//
// Public, not package-private — identity.AuthService records/clears
// activity on login and logout, so this has to be visible across the
// package boundary.
@Component
public class SessionActivityStore {

    private final Map<String, Instant> lastActivityByJti = new ConcurrentHashMap<>();

    public Instant getLastActivity(String jti) {
        return lastActivityByJti.get(jti);
    }

    public void recordActivity(String jti, Instant at) {
        lastActivityByJti.put(jti, at);
    }

    public void clear(String jti) {
        lastActivityByJti.remove(jti);
    }
}
