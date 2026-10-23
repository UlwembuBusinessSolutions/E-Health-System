package co.ehealth.platform.identity;

import co.ehealth.platform.core.security.JwtService;
import org.junit.jupiter.api.Test;
import java.time.Instant;
import static org.junit.jupiter.api.Assertions.*;

class SsoSessionExchangeTest {
    @Test void ticketIsRedeemableOnceForItsOwnTenant() {
        SsoSessionExchange exchange = new SsoSessionExchange();
        JwtService.IssuedToken jwt = new JwtService.IssuedToken("signed-jwt", "jti", Instant.now().plusSeconds(600));
        String ticket = exchange.issue("sibanye", jwt);
        assertNotNull(ticket);
        assertEquals("signed-jwt", exchange.consume("sibanye", ticket).token());
        assertNull(exchange.consume("sibanye", ticket), "replay must fail");
    }
    @Test void ticketCannotBeUsedAcrossTenants() {
        SsoSessionExchange exchange = new SsoSessionExchange();
        String ticket = exchange.issue("sibanye", new JwtService.IssuedToken("signed", "jti", Instant.now()));
        assertNull(exchange.consume("other-tenant", ticket));
    }
}
