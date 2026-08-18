package co.ehealth.platform.core.security;

import co.ehealth.platform.core.audit.AuditLogService;
import co.ehealth.platform.core.tenant.TenantContext;
import co.ehealth.platform.identity.UserRepository;
import io.jsonwebtoken.Claims;
import jakarta.servlet.FilterChain;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class JwtAuthenticationFilterTest {

    private final JwtService jwtService = mock(JwtService.class);
    private final UserRepository userRepository = mock(UserRepository.class);
    private final AuditLogService auditLogService = mock(AuditLogService.class);
    private final JwtAuthenticationFilter filter =
            new JwtAuthenticationFilter(jwtService, userRepository, auditLogService);

    @AfterEach
    void clearContext() {
        TenantContext.clear();
    }

    @Test
    void tokenForAnotherTenant_isDeniedAndAuditLoggedBeforeAnyDataLookup() throws Exception {
        UUID userId = UUID.randomUUID();
        Claims claims = mock(Claims.class);
        when(claims.get("tenant", String.class)).thenReturn("tenant_a");
        when(claims.getSubject()).thenReturn(userId.toString());
        when(jwtService.parseAndValidate("signed-token")).thenReturn(claims);
        TenantContext.setCurrentTenant("tenant_b");

        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/v1/roles");
        request.addHeader("Authorization", "Bearer signed-token");
        request.setRemoteAddr("203.0.113.10");
        MockHttpServletResponse response = new MockHttpServletResponse();
        FilterChain chain = mock(FilterChain.class);

        filter.doFilter(request, response, chain);

        assertThat(response.getStatus()).isEqualTo(403);
        assertThat(response.getContentAsString()).contains("Access to another tenant is forbidden");
        verify(auditLogService).append(
                eq(null), eq(null), eq("CROSS_TENANT_ACCESS_DENIED"), eq("TenantAccess"),
                eq(userId.toString()), eq(null),
                eq("{\"tokenTenant\":\"tenant_a\",\"requestTenant\":\"tenant_b\"}"),
                eq("203.0.113.10"));
        verify(userRepository, never()).findById(any());
        verify(chain, never()).doFilter(any(), any());
    }
}
