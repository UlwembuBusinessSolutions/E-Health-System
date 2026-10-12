package co.ehealth.platform.identity;

import co.ehealth.platform.core.audit.AuditLogService;
import co.ehealth.platform.core.common.GlobalExceptionHandler;
import co.ehealth.platform.core.security.IdleLockFilter;
import co.ehealth.platform.core.security.JwtAuthenticationFilter;
import co.ehealth.platform.core.security.JwtService;
import co.ehealth.platform.core.security.SessionActivityStore;
import co.ehealth.platform.core.tenant.TenantContext;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.method.annotation.AuthenticationPrincipalArgumentResolver;
import org.springframework.http.converter.json.MappingJackson2HttpMessageConverter;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class AuthSessionTest {
    private final Instant startedAt = Instant.parse("2030-01-10T08:00:00Z");
    private final MutableClock clock = new MutableClock(startedAt);
    private final SessionActivityStore activityStore = new SessionActivityStore();
    private final UserRepository users = mock(UserRepository.class);
    private final User user = mock(User.class);
    private final PasswordEncoder passwords = mock(PasswordEncoder.class);
    private final UUID userId = UUID.randomUUID();
    private final ObjectMapper mapper = new ObjectMapper().findAndRegisterModules()
            .disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);
    private final JwtService jwt = new JwtService("a-test-only-session-signing-secret-longer-than-32-bytes", 720, clock);
    private MockMvc mvc;
    private JwtService.IssuedToken token;

    @BeforeEach void setup() {
        TenantContext.setCurrentTenant("test_clinic");
        when(users.findById(userId)).thenReturn(Optional.of(user));
        when(user.getId()).thenReturn(userId);
        when(user.getStatus()).thenReturn(UserStatus.ACTIVE);
        when(user.getTokenVersion()).thenReturn(3);
        when(user.getPasswordHash()).thenReturn("password-hash");
        when(users.findRoleNames(userId)).thenReturn(List.of("RECEPTIONIST"));
        token = jwt.issue(userId, "test_clinic", List.of("RECEPTIONIST"), 3);
        activityStore.registerSession(token.jti(), startedAt, token.expiresAt(), startedAt);
        AuthService service = new AuthService(users, passwords, jwt, mock(AuditLogService.class),
                activityStore, clock, mapper, 15);
        mvc = MockMvcBuilders.standaloneSetup(new AuthController(service, mock(PasswordResetService.class), users))
                .setCustomArgumentResolvers(new AuthenticationPrincipalArgumentResolver())
                .setMessageConverters(new MappingJackson2HttpMessageConverter(mapper))
                .setControllerAdvice(new GlobalExceptionHandler())
                .addFilters(new JwtAuthenticationFilter(jwt, users, activityStore, clock),
                        new IdleLockFilter(activityStore, Duration.ofMinutes(15), clock))
                .build();
    }

    @AfterEach void cleanup() {
        SecurityContextHolder.clearContext();
        TenantContext.clear();
    }

    @Test void metadataUsesServerClockAndDoesNotExtendIdleDeadline() throws Exception {
        clock.advance(Duration.ofMinutes(14));
        request(get("/api/v1/auth/session"))
                .andExpect(status().isOk())
                .andExpect(header().string("Cache-Control", "no-store"))
                .andExpect(jsonPath("$.serverTime").value("2030-01-10T08:14:00Z"))
                .andExpect(jsonPath("$.expiresAt").value("2030-01-10T20:00:00Z"))
                .andExpect(jsonPath("$.idleExpiresAt").value("2030-01-10T08:15:00Z"))
                .andExpect(jsonPath("$.idleTimeoutSeconds").value(900))
                .andExpect(jsonPath("$.warningSeconds").value(60));
        assertEquals(startedAt, activityStore.getLastActivity(token.jti()));
        clock.advance(Duration.ofMinutes(1));
        request(get("/api/v1/auth/session")).andExpect(status().is(419));
    }

    @Test void readRequestsCannotKeepAnUnattendedSessionAlive() throws Exception {
        for (int minute = 1; minute <= 14; minute++) {
            clock.advance(Duration.ofMinutes(1));
            request(get("/api/v1/auth/me")).andExpect(status().isOk());
        }
        clock.advance(Duration.ofMinutes(1));
        request(get("/api/v1/auth/me")).andExpect(status().is(419));
        assertEquals(startedAt, activityStore.getLastActivity(token.jti()));
    }

    @Test void explicitActivityExtendsOnlyTheIdleDeadline() throws Exception {
        clock.advance(Duration.ofMinutes(14));
        request(post("/api/v1/auth/session/activity"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.idleExpiresAt").value("2030-01-10T08:29:00Z"))
                .andExpect(jsonPath("$.expiresAt").value("2030-01-10T20:00:00Z"));
    }

    @Test void continueIssuesFreshTokenWithCurrentRolesAndPreservesSessionIdentity() throws Exception {
        clock.advance(Duration.ofMinutes(14));
        when(users.findRoleNames(userId)).thenReturn(List.of("ORG_ADMIN", "RECEPTIONIST"));
        String body = request(post("/api/v1/auth/session/continue"))
                .andExpect(status().isOk())
                .andExpect(header().string("Cache-Control", "no-store"))
                .andExpect(jsonPath("$.expiresAt").value("2030-01-10T20:14:00Z"))
                .andExpect(jsonPath("$.idleExpiresAt").value("2030-01-10T08:29:00Z"))
                .andReturn().getResponse().getContentAsString();
        String renewed = mapper.readTree(body).get("accessToken").asText();
        assertNotEquals(token.token(), renewed);
        var claims = jwt.parseAndValidate(renewed);
        assertEquals(token.jti(), claims.getId());
        assertEquals(List.of("ORG_ADMIN", "RECEPTIONIST"), claims.get("roles", List.class));
        assertEquals(3, claims.get("tokenVersion", Integer.class));
        request(get("/api/v1/auth/session")).andExpect(status().isOk());
        request(get("/api/v1/auth/session"), renewed).andExpect(status().isOk());
    }

    @Test void exactIdleDeadlineBlocksActivityAndContinueWithoutResettingIt() throws Exception {
        clock.advance(Duration.ofMinutes(15));
        request(post("/api/v1/auth/session/activity")).andExpect(status().is(419));
        request(post("/api/v1/auth/session/continue")).andExpect(status().is(419));
        assertEquals(startedAt, activityStore.getLastActivity(token.jti()));
    }

    @Test void expiredTokenCannotBeContinued() throws Exception {
        clock.advance(Duration.ofHours(12).plusSeconds(1));
        request(post("/api/v1/auth/session/continue")).andExpect(status().isUnauthorized());
    }

    @Test void passwordChangeAndAccountDisableCannotBeBypassedByContinue() throws Exception {
        when(user.getTokenVersion()).thenReturn(4);
        request(post("/api/v1/auth/session/continue")).andExpect(status().isUnauthorized());
        when(user.getTokenVersion()).thenReturn(3);
        when(user.getStatus()).thenReturn(UserStatus.DISABLED);
        request(post("/api/v1/auth/session/continue")).andExpect(status().isUnauthorized());
        when(user.getStatus()).thenReturn(UserStatus.LOCKED);
        request(post("/api/v1/auth/session/continue")).andExpect(status().isUnauthorized());
    }

    @Test void idleSessionCanLogOutAndCannotReuseItsToken() throws Exception {
        clock.advance(Duration.ofMinutes(16));
        request(post("/api/v1/auth/logout")).andExpect(status().isNoContent());
        request(post("/api/v1/auth/session/continue")).andExpect(status().isUnauthorized());
        request(get("/api/v1/auth/me")).andExpect(status().isUnauthorized());
    }

    @Test void logoutRevokesRenewalsButDoesNotRevokeIndependentSessions() throws Exception {
        clock.advance(Duration.ofMinutes(14));
        JsonNode continued = mapper.readTree(request(post("/api/v1/auth/session/continue"))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
        var independent = jwt.issue(userId, "test_clinic", List.of("RECEPTIONIST"), 3);
        request(post("/api/v1/auth/logout")).andExpect(status().isNoContent());
        request(get("/api/v1/auth/me"), continued.get("accessToken").asText()).andExpect(status().isUnauthorized());
        request(get("/api/v1/auth/me"), independent.token()).andExpect(status().isOk());
        // Revocation outlives the earlier token used to log out.
        clock.advance(Duration.ofHours(12).minusMinutes(14).plusSeconds(1));
        request(get("/api/v1/auth/me"), continued.get("accessToken").asText()).andExpect(status().isUnauthorized());
    }

    @Test void failedUnlockDoesNotResetIdleLock() throws Exception {
        clock.advance(Duration.ofMinutes(16));
        when(passwords.matches("wrong", "password-hash")).thenReturn(false);
        request(post("/api/v1/auth/unlock").contentType("application/json").content("{\"password\":\"wrong\"}"))
                .andExpect(status().isUnauthorized());
        assertEquals(startedAt, activityStore.getLastActivity(token.jti()));
        request(post("/api/v1/auth/session/continue")).andExpect(status().is(419));
    }

    @Test void successfulUnlockRestoresSessionActivity() throws Exception {
        clock.advance(Duration.ofMinutes(16));
        when(passwords.matches("correct", "password-hash")).thenReturn(true);
        request(post("/api/v1/auth/unlock").contentType("application/json").content("{\"password\":\"correct\"}"))
                .andExpect(status().isNoContent());
        request(get("/api/v1/auth/session"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.idleExpiresAt").value("2030-01-10T08:31:00Z"));
    }

    @Test void missingActivityStateUsesSignedIssueTimeInsteadOfMetadataReadTime() throws Exception {
        var other = jwt.issue(userId, "test_clinic", List.of("RECEPTIONIST"), 3);
        clock.advance(Duration.ofMinutes(14));
        request(get("/api/v1/auth/session"), other.token())
                .andExpect(status().isOk()).andExpect(jsonPath("$.idleExpiresAt").value("2030-01-10T08:15:00Z"));
        clock.advance(Duration.ofMinutes(1));
        request(post("/api/v1/auth/session/continue"), other.token()).andExpect(status().is(419));
    }

    private ResultActions request(MockHttpServletRequestBuilder builder) throws Exception {
        return request(builder, token.token());
    }

    private ResultActions request(MockHttpServletRequestBuilder builder, String bearer) throws Exception {
        SecurityContextHolder.clearContext();
        return mvc.perform(builder.header("Authorization", "Bearer " + bearer));
    }

    private static class MutableClock extends Clock {
        private Instant now;
        MutableClock(Instant now) { this.now = now; }
        void advance(Duration elapsed) { now = now.plus(elapsed); }
        @Override public ZoneId getZone() { return ZoneOffset.UTC; }
        @Override public Clock withZone(ZoneId zone) { return this; }
        @Override public Instant instant() { return now; }
    }
}
