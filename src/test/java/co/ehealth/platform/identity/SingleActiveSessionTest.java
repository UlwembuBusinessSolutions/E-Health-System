package co.ehealth.platform.identity;

import co.ehealth.platform.core.audit.AuditLogService;
import co.ehealth.platform.core.security.*;
import co.ehealth.platform.core.tenant.TenantContext;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.*;
import org.springframework.mock.web.*;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import java.time.*;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class SingleActiveSessionTest {
    private final Instant now = Instant.parse("2026-09-23T10:00:00Z");
    private final Clock clock = Clock.fixed(now, ZoneOffset.UTC);
    private final UserRepository users = mock(UserRepository.class);
    private final PasswordEncoder passwords = mock(PasswordEncoder.class);
    private final AuditLogService audit = mock(AuditLogService.class);
    private final SessionActivityStore activity = new SessionActivityStore();
    private final JwtService jwt = new JwtService("test-secret-with-at-least-thirty-two-bytes-long", 60, clock);
    private final User user = new User("EMP1", "staff@example.org", "Staff", "Member", "123", "hash", null, null);
    private AuthService auth;

    @BeforeEach void setup() {
        ReflectionTestUtils.setField(user, "id", UUID.randomUUID());
        TenantContext.setCurrentTenant("tenant_test");
        TransactionSynchronizationManager.initSynchronization();
        when(users.findForLoginByEmail(user.getEmail())).thenReturn(Optional.of(user));
        when(users.findById(user.getId())).thenReturn(Optional.of(user));
        when(users.findRoleNames(user.getId())).thenReturn(List.of("NURSE"));
        when(passwords.matches("correct", "hash")).thenReturn(true);
        auth = new AuthService(users, passwords, jwt, audit, activity, clock,
                new ObjectMapper().findAndRegisterModules());
    }

    @AfterEach void cleanup() {
        TransactionSynchronizationManager.clearSynchronization();
        TenantContext.clear();
        SecurityContextHolder.clearContext();
    }

    private void commit() {
        TransactionSynchronizationManager.getSynchronizations().forEach(s -> s.afterCommit());
        TransactionSynchronizationManager.clearSynchronization();
        TransactionSynchronizationManager.initSynchronization();
    }

    private MockHttpServletResponse request(JwtService.IssuedToken token, String address) throws Exception {
        SecurityContextHolder.clearContext();
        var request = new MockHttpServletRequest("GET", "/api/v1/auth/me");
        request.setRemoteAddr(address);
        request.addHeader("Authorization", "Bearer " + token.token());
        var response = new MockHttpServletResponse();
        new JwtAuthenticationFilter(jwt, users).doFilter(request, response, (req, res) -> res.setContentType("accepted"));
        return response;
    }

    @Test void secondLoginDisplacesFirstAndAuditsReplacement() throws Exception {
        var first = auth.login(user.getEmail(), "correct");
        commit();
        var second = auth.login(user.getEmail(), "correct");
        commit();
        assertEquals(second.jti(), user.getActiveSessionJti());
        assertNull(activity.getLastActivity(first.jti()));
        assertEquals(now, activity.getLastActivity(second.jti()));
        var denied = request(first, "10.0.0.1");
        assertEquals(401, denied.getStatus());
        assertEquals("SESSION_REPLACED_OR_ENDED", denied.getHeader("X-Session-Status"));
        assertTrue(denied.getContentAsString().contains("signed in elsewhere"));
        assertNull(SecurityContextHolder.getContext().getAuthentication());
        assertEquals("accepted", request(second, "10.0.0.2").getContentType());
        assertEquals("accepted", request(second, "10.0.0.3").getContentType());
        verify(audit).append(eq(user.getId()), isNull(), eq("SESSION_DISPLACED"), eq("User"),
                eq(user.getId().toString()), contains(first.jti()), contains(second.jti()));
    }

    @Test void ssoAlsoDisplacesPasswordSession() throws Exception {
        var first = auth.login(user.getEmail(), "correct");
        var second = auth.loginViaSso(user.getEmail()).orElseThrow();
        assertEquals(401, request(first, "10.0.0.1").getStatus());
        assertEquals("accepted", request(second, "10.0.0.2").getContentType());
    }

    @Test void failedLoginKeepsExistingSession() {
        var first = auth.login(user.getEmail(), "correct");
        assertThrows(InvalidCredentialsException.class, () -> auth.login(user.getEmail(), "wrong"));
        assertEquals(first.jti(), user.getActiveSessionJti());
        verify(audit, never()).append(any(), any(), eq("SESSION_DISPLACED"), any(), any(), any(), any());
    }

    @Test void expiredSessionDoesNotProduceDisplacementAudit() {
        user.activateSession(UUID.randomUUID().toString(), now.minusSeconds(1));
        auth.login(user.getEmail(), "correct");
        verify(audit, never()).append(any(), any(), eq("SESSION_DISPLACED"), any(), any(), any(), any());
    }

    @Test void logoutTargetsOnlyThePresentedSession() {
        var first = auth.login(user.getEmail(), "correct");
        var second = auth.login(user.getEmail(), "correct");
        auth.logout(first.jti());
        verify(users).clearActiveSession(first.jti());
        assertEquals(second.jti(), user.getActiveSessionJti());
    }

    @Test void unregisteredTokensAndOtherTenantsAreRejected() throws Exception {
        var legacy = jwt.issue(user.getId(), "tenant_test", List.of("NURSE"), 0);
        assertEquals(401, request(legacy, "10.0.0.1").getStatus());
        var current = auth.login(user.getEmail(), "correct");
        TenantContext.setCurrentTenant("tenant_other");
        assertEquals(401, request(current, "10.0.0.1").getStatus());
    }
}
