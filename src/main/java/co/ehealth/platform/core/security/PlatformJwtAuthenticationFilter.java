package co.ehealth.platform.core.security;

import co.ehealth.platform.core.common.FilterResponses;
import co.ehealth.platform.platform.PlatformOperator;
import co.ehealth.platform.platform.PlatformOperatorRepository;
import co.ehealth.platform.platform.PlatformOperatorStatus;
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

// Real per-operator JWT instead of one shared secret string everyone holds.
// Deliberately keeps the header name X-Platform-Key rather than switching
// to Authorization: Bearer — the tenant JwtAuthenticationFilter already
// reads Authorization and verifies against a different signing key
// (JwtService's, not PlatformJwtService's); reusing that header risks
// either filter trying to parse a token it can't verify. Two header names,
// two filters, no collision possible.
public class PlatformJwtAuthenticationFilter extends OncePerRequestFilter {

    private static final String PLATFORM_TOKEN_HEADER = "X-Platform-Key";
    private static final String INVALID_TOKEN_MESSAGE = "Session expired. Please sign in again.";

    private final PlatformJwtService platformJwtService;
    private final PlatformOperatorRepository platformOperatorRepository;

    public PlatformJwtAuthenticationFilter(PlatformJwtService platformJwtService,
                                            PlatformOperatorRepository platformOperatorRepository) {
        this.platformJwtService = platformJwtService;
        this.platformOperatorRepository = platformOperatorRepository;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        String token = request.getHeader(PLATFORM_TOKEN_HEADER);
        if (token == null) {
            FilterResponses.writeJsonError(response, HttpServletResponse.SC_UNAUTHORIZED, INVALID_TOKEN_MESSAGE);
            return;
        }

        Claims claims;
        try {
            claims = platformJwtService.parseAndValidate(token);
        } catch (InvalidTokenException e) {
            // This filter runs before the DispatcherServlet, so an
            // exception thrown here never reaches GlobalExceptionHandler —
            // left uncaught, a malformed/expired/tampered token was
            // producing a bare 403 with an empty body instead of the
            // documented { message, fieldErrors } shape every other error
            // response in this API uses.
            FilterResponses.writeJsonError(response, HttpServletResponse.SC_UNAUTHORIZED, INVALID_TOKEN_MESSAGE);
            return;
        }

        UUID operatorId = UUID.fromString(claims.getSubject());
        Optional<PlatformOperator> operator = platformOperatorRepository.findById(operatorId);
        int tokenVersion = claims.get("tokenVersion", Integer.class);

        if (operator.isEmpty() || operator.get().getTokenVersion() != tokenVersion
                || operator.get().getStatus() != PlatformOperatorStatus.ACTIVE) {
            // Password changed, or the account got locked/disabled, since
            // this token was issued — same reasoning as the tenant filter:
            // tokenVersion mismatch or a non-ACTIVE status both mean "don't
            // trust this token," whether or not it's still within its
            // natural expiry.
            FilterResponses.writeJsonError(response, HttpServletResponse.SC_UNAUTHORIZED, INVALID_TOKEN_MESSAGE);
            return;
        }

        var authentication = new UsernamePasswordAuthenticationToken(
                new PlatformOperatorPrincipal(operatorId, claims.getId()), null,
                List.of(new SimpleGrantedAuthority("ROLE_PLATFORM_OPERATOR")));
        SecurityContextHolder.getContext().setAuthentication(authentication);

        chain.doFilter(request, response);
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String uri = request.getRequestURI();
        // /platform/auth/login is how an operator gets a token in the
        // first place — can't require one to reach it.
        // SADM-US-005 exposes the platform tenant register at /api/v1 to
        // match the console's API contract. It still uses the same operator
        // token as /platform/**; without this exception SecurityConfig sees
        // no authenticated principal and correctly (but unhelpfully) 403s.
        boolean platformProtectedRoute = uri.startsWith("/platform/") || uri.startsWith("/api/v1/tenants");
        return !platformProtectedRoute || uri.equals("/platform/auth/login");
    }
}
