package co.ehealth.platform.core.security;

import co.ehealth.platform.core.common.FilterResponses;
import co.ehealth.platform.core.tenant.TenantContext;
import co.ehealth.platform.patient.PatientAccount;
import co.ehealth.platform.patient.PatientAccountRepository;
import co.ehealth.platform.patient.PatientAccountStatus;
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

// A dedicated header (X-Patient-Key), not Authorization: Bearer — same
// reasoning PlatformJwtAuthenticationFilter's own why-note gives for
// X-Platform-Key: JwtAuthenticationFilter (staff) has no shouldNotFilter
// override and unconditionally tries to parse ANY Authorization header
// present, against ITS OWN signing key, on every request regardless of
// path. A patient token presented as Authorization: Bearer would hit that
// filter first, fail signature verification there (wrong key), and get
// rejected with a 401 before this filter ever ran. A separate header
// makes that collision impossible instead of relying on filter ordering.
public class PatientJwtAuthenticationFilter extends OncePerRequestFilter {

    private static final String PATIENT_TOKEN_HEADER = "X-Patient-Key";
    private static final String INVALID_TOKEN_MESSAGE = "Session expired. Please sign in again.";

    private final PatientJwtService patientJwtService;
    private final PatientAccountRepository patientAccountRepository;

    public PatientJwtAuthenticationFilter(PatientJwtService patientJwtService,
                                           PatientAccountRepository patientAccountRepository) {
        this.patientJwtService = patientJwtService;
        this.patientAccountRepository = patientAccountRepository;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        String token = request.getHeader(PATIENT_TOKEN_HEADER);
        if (token == null) {
            FilterResponses.writeJsonError(response, HttpServletResponse.SC_UNAUTHORIZED, INVALID_TOKEN_MESSAGE);
            return;
        }

        Claims claims;
        try {
            claims = patientJwtService.parseAndValidate(token);
        } catch (InvalidTokenException e) {
            FilterResponses.writeJsonError(response, HttpServletResponse.SC_UNAUTHORIZED, INVALID_TOKEN_MESSAGE);
            return;
        }

        String tokenTenant = claims.get("tenant", String.class);
        if (!tokenTenant.equals(TenantContext.getCurrentTenant())) {
            // Same check as JwtAuthenticationFilter's own — a token minted
            // for one tenant presented against another.
            FilterResponses.writeJsonError(response, HttpServletResponse.SC_UNAUTHORIZED, INVALID_TOKEN_MESSAGE);
            return;
        }

        UUID patientAccountId = UUID.fromString(claims.getSubject());
        Optional<PatientAccount> account = patientAccountRepository.findById(patientAccountId);
        int tokenVersion = claims.get("tokenVersion", Integer.class);

        if (account.isEmpty() || account.get().getTokenVersion() != tokenVersion
                || account.get().getStatus() != PatientAccountStatus.ACTIVE) {
            FilterResponses.writeJsonError(response, HttpServletResponse.SC_UNAUTHORIZED, INVALID_TOKEN_MESSAGE);
            return;
        }

        var authentication = new UsernamePasswordAuthenticationToken(
                new PatientPrincipal(patientAccountId, claims.getId()), null,
                List.of(new SimpleGrantedAuthority("ROLE_PATIENT")));
        SecurityContextHolder.getContext().setAuthentication(authentication);

        chain.doFilter(request, response);
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String uri = request.getRequestURI();
        // /api/v1/patient/register and /api/v1/patient/auth/login are how
        // a patient gets a token (or an account) in the first place — can't
        // require one to reach either. Every other path on this filter
        // (including everything outside /api/v1/patient/**) is skipped
        // entirely, mirroring PlatformJwtAuthenticationFilter's own scoping.
        return !uri.startsWith("/api/v1/patient/") || uri.equals("/api/v1/patient/register")
                || uri.equals("/api/v1/patient/auth/login");
    }
}
