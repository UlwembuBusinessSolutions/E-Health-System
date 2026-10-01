package co.ehealth.platform.core.security;

import java.time.*;
import org.junit.jupiter.api.*;
import org.springframework.mock.web.*;
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import static org.junit.jupiter.api.Assertions.*;

class IdleLockFilterTest {
    private final Instant now = Instant.parse("2026-09-23T10:00:00Z");
    private final SessionActivityStore activity = new SessionActivityStore();

    @AfterEach void cleanup() { SecurityContextHolder.clearContext(); }

    private MockHttpServletResponse request(String method, String path) throws Exception {
        SecurityContextHolder.getContext().setAuthentication(
                new TestingAuthenticationToken("staff", null, "ROLE_STAFF"));
        activity.recordActivity("session", now.minus(Duration.ofMinutes(20)));
        var request = new MockHttpServletRequest(method, path);
        request.setAttribute("jti", "session");
        var response = new MockHttpServletResponse();
        new IdleLockFilter(activity, Duration.ofMinutes(15), Clock.fixed(now, ZoneOffset.UTC))
                .doFilter(request, response, (req, res) -> res.setContentType("accepted"));
        return response;
    }

    @Test void idleSessionCanLogOut() throws Exception {
        assertEquals("accepted", request("POST", "/api/v1/auth/logout").getContentType());
    }

    @Test void idleSessionCannotAccessProtectedResource() throws Exception {
        assertEquals(419, request("GET", "/api/v1/auth/me").getStatus());
        assertEquals(now.minus(Duration.ofMinutes(20)), activity.getLastActivity("session"));
    }

    @Test void logoutExemptionRequiresPost() throws Exception {
        assertEquals(419, request("GET", "/api/v1/auth/logout").getStatus());
    }
}
