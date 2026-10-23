package co.ehealth.platform.identity;

import co.ehealth.platform.core.security.JwtService;
import org.springframework.stereotype.Service;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.concurrent.ConcurrentHashMap;

/** One-time, short-lived browser handoff avoids placing bearer JWTs in URLs, access logs and referrers. */
@Service
public class SsoSessionExchange {
    private static final Duration TTL = Duration.ofSeconds(60);
    private final SecureRandom random = new SecureRandom();
    private final ConcurrentHashMap<String, Ticket> tickets = new ConcurrentHashMap<>();
    private record Ticket(String tenant, JwtService.IssuedToken token, Instant expires) {}

    public String issue(String tenant, JwtService.IssuedToken token) {
        tickets.entrySet().removeIf(e -> e.getValue().expires().isBefore(Instant.now()));
        byte[] bytes = new byte[32];
        random.nextBytes(bytes);
        String ticket = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        tickets.put(ticket, new Ticket(tenant, token, Instant.now().plus(TTL)));
        return ticket;
    }

    public JwtService.IssuedToken consume(String tenant, String ticket) {
        if (ticket == null || ticket.isBlank()) return null;
        Ticket existing = tickets.remove(ticket); // atomic: second submission cannot use the same ticket
        if (existing == null || existing.expires().isBefore(Instant.now()) || !existing.tenant().equals(tenant))
            return null;
        return existing.token();
    }
}
