package co.ehealth.platform.core.security;

import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicReference;

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

    private final Map<String, SessionState> sessions = new ConcurrentHashMap<>();
    private final AtomicReference<Instant> nextCleanupAt = new AtomicReference<>(Instant.EPOCH);

    public Instant getLastActivity(String jti) {
        SessionState state = sessions.get(jti);
        return state == null ? null : state.lastActivity();
    }

    public void recordActivity(String jti, Instant at) {
        sessions.compute(jti, (key, state) -> {
            if (state == null) return new SessionState(at, null, false);
            if (state.revoked()) return state;
            return new SessionState(later(state.lastActivity(), at), state.expiresAt(), false);
        });
    }

    // Missing in-memory state (for example after a restart) starts at the
    // signed token's issue time. Reading session metadata never starts a new
    // inactivity period. Keep the longest expiry when the same session renews.
    public void registerSession(String jti, Instant issuedAt, Instant expiresAt, Instant now) {
        cleanExpired(now);
        sessions.compute(jti, (key, state) -> state == null
                ? new SessionState(issuedAt, expiresAt, false)
                : new SessionState(state.lastActivity(), later(state.expiresAt(), expiresAt), state.revoked()));
    }

    public boolean isRevoked(String jti) {
        SessionState state = sessions.get(jti);
        return state != null && state.revoked();
    }

    public void revoke(String jti, Instant expiresAt) {
        sessions.compute(jti, (key, state) -> state == null
                ? new SessionState(null, expiresAt, true)
                : new SessionState(state.lastActivity(), later(state.expiresAt(), expiresAt), true));
    }

    private void cleanExpired(Instant now) {
        Instant next = nextCleanupAt.get();
        if (!now.isBefore(next) && nextCleanupAt.compareAndSet(next, now.plusSeconds(300))) {
            sessions.entrySet().removeIf(entry -> entry.getValue().expiresAt() != null
                    && !entry.getValue().expiresAt().isAfter(now));
        }
    }

    private static Instant later(Instant first, Instant second) {
        return first == null || second.isAfter(first) ? second : first;
    }

    private record SessionState(Instant lastActivity, Instant expiresAt, boolean revoked) {
    }
}
