package co.ehealth.platform.core.clinic;

import co.ehealth.platform.core.common.FilterResponses;
import co.ehealth.platform.core.security.AuthenticatedPrincipal;
import co.ehealth.platform.identity.ClinicScopeService;
import co.ehealth.platform.identity.UserRepository;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;
import java.io.IOException;
import java.util.UUID;

public class ClinicContextFilter extends OncePerRequestFilter {
    private final ClinicScopeService scopes;
    private final UserRepository users;

    public ClinicContextFilter(ClinicScopeService scopes, UserRepository users) {
        this.scopes = scopes;
        this.users = users;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws IOException, ServletException {
        ClinicContext.clear();
        try {
            var authentication = SecurityContextHolder.getContext().getAuthentication();
            if (authentication != null && authentication.getPrincipal() instanceof AuthenticatedPrincipal principal) {
                UUID requested = null;
                String header = request.getHeader("X-Clinic-ID");
                if (header != null) {
                    try { requested = UUID.fromString(header); }
                    catch (IllegalArgumentException ex) {
                        FilterResponses.writeJsonError(response, 400, "X-Clinic-ID must be a UUID.");
                        return;
                    }
                }
                UUID clinic;
                try {
                    var user = users.findById(principal.userId()).orElseThrow();
                    clinic = scopes.resolve(principal.userId(), user.getFacilityId(), requested);
                } catch (ClinicAccessDeniedException ex) {
                    FilterResponses.writeJsonError(response, 403, ex.getMessage());
                    return;
                }
                ClinicContext.set(clinic);
                var authorities = scopes.rolesInClinic(principal.userId(), clinic).stream()
                        .map(role -> new SimpleGrantedAuthority("ROLE_" + role)).toList();
                SecurityContextHolder.getContext().setAuthentication(
                        new UsernamePasswordAuthenticationToken(principal, null, authorities));
            }
            chain.doFilter(request, response);
        } finally {
            ClinicContext.clear();
        }
    }
}
