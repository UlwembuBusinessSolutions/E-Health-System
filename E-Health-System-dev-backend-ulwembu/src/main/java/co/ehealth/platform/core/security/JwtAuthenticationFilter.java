package co.ehealth.platform.core.security;

import co.ehealth.platform.core.audit.AuditLogService;
import co.ehealth.platform.core.common.FilterResponses;
import co.ehealth.platform.core.tenant.TenantContext;
import co.ehealth.platform.identity.User;
import co.ehealth.platform.identity.UserRepository;
import io.jsonwebtoken.Claims;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private final JwtService jwtService;
    private final UserRepository userRepository;
    private final AuditLogService auditLogService;

    public JwtAuthenticationFilter(
            JwtService jwtService,
            UserRepository userRepository,
            AuditLogService auditLogService) {
        this.jwtService = jwtService;
        this.userRepository = userRepository;
        this.auditLogService = auditLogService;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return request.getRequestURI().startsWith("/platform/");
    }

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain chain)
            throws ServletException, IOException {

        String header = request.getHeader("Authorization");

        if (header == null || !header.startsWith("Bearer ")) {
            chain.doFilter(request, response);
            return;
        }

        Claims claims;

        try {
            claims = jwtService.parseAndValidate(header.substring(7));
        } catch (InvalidTokenException e) {
            FilterResponses.writeJsonError(
                    response,
                    HttpServletResponse.SC_UNAUTHORIZED,
                    "Session expired. Please sign in again.");
            return;
        }

        String tokenTenant = claims.get("tenant", String.class);

        if (!tokenTenant.equals(TenantContext.getCurrentTenant())) {

            if (isTenantAuditRequest(request)) {
                String requestedTenant = TenantContext.getCurrentTenant();

                try {
                    TenantContext.setCurrentTenant(tokenTenant);

                    UUID userId = UUID.fromString(claims.getSubject());

                    auditLogService.append(
                            userId,
                            null,
                            "AUDIT_ACCESS_DENIED",
                            "AuditLog",
                            requestedTenant == null ? "unknown" : requestedTenant,
                            null,
                            "{\"requestedTenant\":\""
                                    + requestedTenant
                                    + "\"}");

                } finally {
                    if (requestedTenant == null) {
                        TenantContext.clear();
                    } else {
                        TenantContext.setCurrentTenant(requestedTenant);
                    }
                }

                FilterResponses.writeJsonError(
                        response,
                        HttpServletResponse.SC_FORBIDDEN,
                        "You may only view your organization's audit events.");
                return;
            }

            FilterResponses.writeJsonError(
                    response,
                    HttpServletResponse.SC_UNAUTHORIZED,
                    "Session expired. Please sign in again.");
            return;
        }

        UUID userId = UUID.fromString(claims.getSubject());

        Optional<User> user = userRepository.findById(userId);

        int tokenVersion = claims.get("tokenVersion", Integer.class);

        if (user.isEmpty() || user.get().getTokenVersion() != tokenVersion) {
            FilterResponses.writeJsonError(
                    response,
                    HttpServletResponse.SC_UNAUTHORIZED,
                    "Session expired. Please sign in again.");
            return;
        }

        @SuppressWarnings("unchecked")
        List<String> roles = claims.get("roles", List.class);

        List<SimpleGrantedAuthority> authorities = roles.stream()
                .map(role -> new SimpleGrantedAuthority("ROLE_" + role))
                .toList();

        var authentication = new UsernamePasswordAuthenticationToken(
                new AuthenticatedPrincipal(userId, claims.getId()),
                null,
                authorities);

        SecurityContextHolder.getContext().setAuthentication(authentication);
        request.setAttribute("jti", claims.getId());

        chain.doFilter(request, response);
    }

    private boolean isTenantAuditRequest(HttpServletRequest request) {
        return request.getRequestURI().equals("/api/v1/admin/audit");
    }
}