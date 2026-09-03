package co.ehealth.platform.platform;

import co.ehealth.platform.core.common.RequestMetadata;
import co.ehealth.platform.core.tenant.TenantAccessTracker;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.Clock;
import java.util.Set;
import java.util.UUID;

// BR-AUDT-030 AC2: "Given any query returns data spanning more than one
// tenant, Then a CROSS_TENANT_ACCESS event is raised regardless of the
// querying role." Wraps the ENTIRE request, ahead of TenantFilter (see
// TenantFilterConfig's own why-note on ordering) — TenantAccessTracker.reset()
// has to run before the first tenant switch of the request, and the
// touched-schema check has to run after the last one.
//
// A normal tenant-app request (/api/v1/**) can never trip this: TenantFilter
// resolves and sets exactly one tenant for its entire duration. Only a
// platform-operator-driven request that reaches into more than one
// organization's schema in a single call can currently produce more than
// one distinct schema here — nothing in this codebase does that yet — but
// this filter doesn't special-case /platform/**, deliberately, per the
// AC's own "regardless of ... role."
public class CrossTenantAccessFilter extends OncePerRequestFilter {

    private final PlatformAuditLogRepository platformAuditLogRepository;
    private final Clock clock;

    public CrossTenantAccessFilter(PlatformAuditLogRepository platformAuditLogRepository, Clock clock) {
        this.platformAuditLogRepository = platformAuditLogRepository;
        this.clock = clock;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        TenantAccessTracker.reset();
        try {
            chain.doFilter(request, response);
        } finally {
            recordIfCrossTenant(request);
            // Reset again on the way out — Tomcat will hand this worker
            // thread to a completely unrelated request next.
            TenantAccessTracker.reset();
        }
    }

    private void recordIfCrossTenant(HttpServletRequest request) {
        Set<String> touchedSchemas = TenantAccessTracker.getTouchedSchemas();
        if (touchedSchemas.size() <= 1) {
            return;
        }

        UUID operatorId = currentPlatformOperatorId(request);
        String detail = "path=%s; schemas=%s".formatted(request.getRequestURI(), String.join(",", touchedSchemas));
        // The explicit-ip/device constructor, not the auto-deriving one —
        // see PlatformAuditLog's own why-note on why.
        platformAuditLogRepository.save(new PlatformAuditLog(operatorId, "CROSS_TENANT_ACCESS", null, detail,
                RequestMetadata.currentIpAddress(request), RequestMetadata.currentUserAgent(request),
                clock.instant()));
    }

    // Null when the request wasn't authenticated as a platform operator at
    // all — AC2 fires "regardless of the querying role," including the
    // (currently theoretical, given this codebase's architecture) case of
    // no operator being involved. Read from the request attribute
    // PlatformJwtAuthenticationFilter sets, not SecurityContextHolder —
    // that's already been cleared by the time this runs (see that filter's
    // own why-note).
    private UUID currentPlatformOperatorId(HttpServletRequest request) {
        Object operatorId = request.getAttribute("platformOperatorId");
        return operatorId instanceof UUID uuid ? uuid : null;
    }
}