package co.ehealth.platform.core.security;

import co.ehealth.platform.core.audit.AuditLogService;
import co.ehealth.platform.core.tenant.TenantContext;
import co.ehealth.platform.identity.User;
import co.ehealth.platform.identity.UserRepository;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import jakarta.servlet.FilterChain;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.assertj.core.api.Assertions.assertThat;

class JwtAuthenticationFilterAuditTest {

    private static final UUID USER_ID = UUID.fromString("3d6dac71-6c72-43ee-b0de-3b64f0b1d7f1");

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    @Test
    void tenantMismatchedAuditRequestIsRejectedAndAuditedInTheCallerTenant() throws Exception {
        JwtService jwtService = mock(JwtService.class);
        UserRepository userRepository = mock(UserRepository.class);
        AuditLogService auditLogService = mock(AuditLogService.class);
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/v1/admin/audit");
        MockHttpServletResponse response = new MockHttpServletResponse();
        FilterChain chain = mock(FilterChain.class);

        TenantContext.setCurrentTenant("tenant-b");
        Claims claims = Jwts.claims()
                .subject(USER_ID.toString())
                .add("tenant", "tenant-a")
                .add("roles", List.of("ORG_ADMIN"))
                .add("tokenVersion", 7)
                .build();
        when(jwtService.parseAndValidate("token")).thenReturn(claims);

        request.addHeader("Authorization", "Bearer token");

        new JwtAuthenticationFilter(jwtService, userRepository, auditLogService)
                .doFilterInternal(request, response, chain);

        assertThat(response.getStatus()).isEqualTo(403);
        assertThat(response.getContentAsString()).contains("You may only view your organization's audit events.");
        verify(auditLogService).append(eq(USER_ID), isNull(), eq("AUDIT_ACCESS_DENIED"), eq("AuditLog"),
                eq("tenant-b"), isNull(), contains("\"requestedTenant\":\"tenant-b\""));
        verify(chain, never()).doFilter(request, response);
    }

    @Test
    void matchingTenantAllowsAuditAccessWithoutCreatingDeniedAccessAuditEntry() throws Exception {
        JwtService jwtService = mock(JwtService.class);
        UserRepository userRepository = mock(UserRepository.class);
        AuditLogService auditLogService = mock(AuditLogService.class);
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/v1/admin/audit");
        MockHttpServletResponse response = new MockHttpServletResponse();
        FilterChain chain = mock(FilterChain.class);
        User user = mock(User.class);

        TenantContext.setCurrentTenant("tenant-a");
        Claims claims = Jwts.claims()
                .subject(USER_ID.toString())
                .add("tenant", "tenant-a")
                .add("roles", List.of("ORG_ADMIN"))
                .add("tokenVersion", 7)
                .build();
        when(jwtService.parseAndValidate("token")).thenReturn(claims);
        when(userRepository.findById(USER_ID)).thenReturn(Optional.of(user));
        when(user.getTokenVersion()).thenReturn(7);

        request.addHeader("Authorization", "Bearer token");

        new JwtAuthenticationFilter(jwtService, userRepository, auditLogService)
                .doFilterInternal(request, response, chain);

        assertThat(response.getStatus()).isEqualTo(200);
        verify(chain).doFilter(request, response);
        verify(auditLogService, never()).append(org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any(),
                org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any(),
                org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any());
    }

    @Test
    void mismatchedNonAuditRequestIsRejectedWithoutSelfAuditing() throws Exception {
        JwtService jwtService = mock(JwtService.class);
        UserRepository userRepository = mock(UserRepository.class);
        AuditLogService auditLogService = mock(AuditLogService.class);
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/v1/facilities");
        MockHttpServletResponse response = new MockHttpServletResponse();
        FilterChain chain = mock(FilterChain.class);

        TenantContext.setCurrentTenant("tenant-b");
        Claims claims = Jwts.claims()
                .subject(USER_ID.toString())
                .add("tenant", "tenant-a")
                .add("roles", List.of("ORG_ADMIN"))
                .add("tokenVersion", 7)
                .build();
        when(jwtService.parseAndValidate("token")).thenReturn(claims);

        request.addHeader("Authorization", "Bearer token");

        new JwtAuthenticationFilter(jwtService, userRepository, auditLogService)
                .doFilterInternal(request, response, chain);

        assertThat(response.getStatus()).isEqualTo(401);
        assertThat(response.getContentAsString()).contains("Session expired. Please sign in again.");
        verify(auditLogService, never()).append(org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any(),
                org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any(),
                org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any());
        verify(chain, never()).doFilter(request, response);
    }
}
