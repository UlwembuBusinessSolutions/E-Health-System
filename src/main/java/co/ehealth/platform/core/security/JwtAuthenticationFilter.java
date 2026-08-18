package co.ehealth.platform.core.security;

import co.ehealth.platform.core.common.FilterResponses;
import co.ehealth.platform.core.audit.AuditLogService;
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

    public JwtAuthenticationFilter(JwtService jwtService, UserRepository userRepository,
                                   AuditLogService auditLogService) {
        this.jwtService = jwtService;
        this.userRepository = userRepository;
        this.auditLogService = auditLogService;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
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
            // This filter runs before the DispatcherServlet, so an
            // exception thrown here never reaches GlobalExceptionHandler
            // (that advice only sees exceptions from @RestController
            // methods) — left uncaught, a malformed/expired/tampered token
            // was producing a bare 403 with an empty body instead of the
            // documented { message, fieldErrors } shape every other error
            // response in this API uses. FilterResponses.writeJsonError is
            // the same utility TenantFilter and IdleLockFilter already use
            // for exactly this reason.
            FilterResponses.writeJsonError(response, HttpServletResponse.SC_UNAUTHORIZED,
                    "Session expired. Please sign in again.");
            return;
        }

        String tokenTenant = claims.get("tenant", String.class);
        String requestTenant = TenantContext.getCurrentTenant();
        if (tokenTenant == null || !tokenTenant.equals(requestTenant)) {
            // A token minted for one client presented against another
            // client's subdomain is an authorization violation, rather than
            // an expired session. The actor cannot be referenced from the
            // target tenant's audit_log (its FK points at that tenant's
            // users table), so retain the immutable subject in entity_id.
            auditLogService.append(
                    null,
                    null,
                    "CROSS_TENANT_ACCESS_DENIED",
                    "TenantAccess",
                    claims.getSubject(),
                    null,
                    "{\"tokenTenant\":\"" + tokenTenant
                            + "\",\"requestTenant\":\"" + requestTenant + "\"}",
                    request.getRemoteAddr());
            FilterResponses.writeJsonError(response, HttpServletResponse.SC_FORBIDDEN,
                    "Access to another tenant is forbidden.");
            return;
        }

        UUID userId = UUID.fromString(claims.getSubject());
        Optional<User> user = userRepository.findById(userId);
        int tokenVersion = claims.get("tokenVersion", Integer.class);

        if (user.isEmpty() || user.get().getTokenVersion() != tokenVersion) {
            // Password changed, or the account was disabled, since this
            // token was issued — tokenVersion no longer matches, so it's
            // treated as revoked even though it hasn't naturally expired.
            FilterResponses.writeJsonError(response, HttpServletResponse.SC_UNAUTHORIZED,
                    "Session expired. Please sign in again.");
            return;
        }

        @SuppressWarnings("unchecked")
        List<String> roles = claims.get("roles", List.class);
        List<SimpleGrantedAuthority> authorities = roles.stream()
                .map(role -> new SimpleGrantedAuthority("ROLE_" + role))
                .toList();

        var authentication = new UsernamePasswordAuthenticationToken(
                new AuthenticatedPrincipal(userId, claims.getId()), null, authorities);
        SecurityContextHolder.getContext().setAuthentication(authentication);
        request.setAttribute("jti", claims.getId());

        chain.doFilter(request, response);
    }
}
