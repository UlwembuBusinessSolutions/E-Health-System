package co.ehealth.platform.core.clinic;

// lihle | 2026-09-09 | Updated regression coverage and fixtures to verify clinic isolation and clinical workflows.

import co.ehealth.platform.core.audit.AuditLog;
import co.ehealth.platform.core.audit.AuditLogRepository;
import co.ehealth.platform.core.audit.AuditLogService;
import co.ehealth.platform.core.security.AuthenticatedPrincipal;
import co.ehealth.platform.identity.ClinicScopeService;
import co.ehealth.platform.identity.User;
import co.ehealth.platform.identity.UserRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import java.time.Clock;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class ClinicContextFilterTest {
    private final UUID userId = UUID.randomUUID();
    private final UUID clinicA = UUID.randomUUID();
    private final UUID clinicB = UUID.randomUUID();
    private final UserRepository users = mock(UserRepository.class);
    private final ClinicScopeService scopes = mock(ClinicScopeService.class);
    private final ClinicContextFilter filter = new ClinicContextFilter(scopes, users);

    @AfterEach
    void cleanup() { ClinicContext.clear(); SecurityContextHolder.clearContext(); }

    private void authenticate() {
        User user = mock(User.class);
        when(user.getFacilityId()).thenReturn(clinicA);
        when(users.findById(userId)).thenReturn(Optional.of(user));
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(
                new AuthenticatedPrincipal(userId, "session"), null, List.of()));
    }

    @Test
    void switchUsesCurrentClinicRolesAndRecordsContextSeparatelyFromEntityFacility() throws Exception {
        authenticate();
        when(scopes.resolve(userId, clinicA, clinicB)).thenReturn(clinicB);
        when(scopes.rolesInClinic(userId, clinicB)).thenReturn(List.of("NURSE"));
        var request = new MockHttpServletRequest("GET", "/api/v1/patients");
        request.addHeader("X-Clinic-ID", clinicB.toString());
        var repository = mock(AuditLogRepository.class);
        var audit = new AuditLogService(repository, Clock.systemUTC());
        filter.doFilter(request, new MockHttpServletResponse(), (req, res) -> {
            assertThat(ClinicContext.get()).isEqualTo(clinicB);
            assertThat(SecurityContextHolder.getContext().getAuthentication().getAuthorities())
                    .extracting("authority").containsExactly("ROLE_NURSE");
            audit.append(userId, clinicA, "TEST", "Facility", clinicA.toString(), null, null);
        });
        var row = ArgumentCaptor.forClass(AuditLog.class);
        verify(repository).save(row.capture());
        assertThat(row.getValue().getClinicContextId()).isEqualTo(clinicB);
        assertThat(row.getValue().getFacilityId()).isEqualTo(clinicA);
        assertThat(ClinicContext.get()).isNull();
    }

    @Test
    void revokedOrForeignClinicNeverReachesTheController() throws Exception {
        authenticate();
        when(scopes.resolve(userId, clinicA, clinicB)).thenThrow(new ClinicAccessDeniedException("Not assigned"));
        var request = new MockHttpServletRequest();
        request.addHeader("X-Clinic-ID", clinicB.toString());
        var response = new MockHttpServletResponse();
        filter.doFilter(request, response, (req, res) -> fail("Must not continue"));
        assertThat(response.getStatus()).isEqualTo(403);
        assertThat(ClinicContext.get()).isNull();
    }

    @Test
    void malformedClinicIsBadRequest() throws Exception {
        authenticate();
        var request = new MockHttpServletRequest();
        request.addHeader("X-Clinic-ID", "invalid");
        var response = new MockHttpServletResponse();
        filter.doFilter(request, response, (req, res) -> fail("Must not continue"));
        assertThat(response.getStatus()).isEqualTo(400);
        verifyNoInteractions(scopes);
    }

    @Test
    void contextIsClearedEvenWhenDownstreamFails() {
        authenticate();
        when(scopes.resolve(userId, clinicA, null)).thenReturn(clinicA);
        when(scopes.rolesInClinic(userId, clinicA)).thenReturn(List.of("NURSE"));
        assertThatThrownBy(() -> filter.doFilter(new MockHttpServletRequest(), new MockHttpServletResponse(),
                (req, res) -> { throw new IllegalStateException("test failure"); }))
                .isInstanceOf(IllegalStateException.class);
        assertThat(ClinicContext.get()).isNull();
    }
}
