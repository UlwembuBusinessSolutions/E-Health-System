package co.ehealth.platform.core.security;

import co.ehealth.platform.core.common.FilterResponses;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;

public class IdleLockFilter extends OncePerRequestFilter {

    private static final int SESSION_LOCKED_STATUS = 419; // non-standard — see Section 9's status table

    private final SessionActivityStore activityStore;
    private final Duration idleTimeout;
    private final Clock clock;

    public IdleLockFilter(SessionActivityStore activityStore, Duration idleTimeout, Clock clock) {
        this.activityStore = activityStore;
        this.idleTimeout = idleTimeout;
        this.clock = clock;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        if (SecurityContextHolder.getContext().getAuthentication() == null) {
            chain.doFilter(request, response);
            return;
        }

        String jti = (String) request.getAttribute("jti");
        if (jti == null) {
            // Only JwtAuthenticationFilter (tenant-user logins) ever sets
            // this attribute — a platform-operator-authenticated request
            // (PlatformJwtAuthenticationFilter) reaches here with no jti at
            // all. Idle-lock is a shared-clinical-terminal concern that was
            // never meant to apply to platform operators, so skip rather
            // than enforce against nothing — and SessionActivityStore's
            // backing ConcurrentHashMap can't take a null key regardless,
            // so this guard is required either way, not just semantically
            // correct.
            chain.doFilter(request, response);
            return;
        }
        Instant now = clock.instant();
        Instant lastActivity = activityStore.getLastActivity(jti);
        boolean isUnlockAttempt = request.getRequestURI().equals("/api/v1/auth/unlock");

        if (lastActivity != null
                && Duration.between(lastActivity, now).compareTo(idleTimeout) > 0
                && !isUnlockAttempt) {
            // Deliberately does NOT touch activityStore here — a request
            // bounced for being idle must not itself count as activity, or
            // a locked screen silently polling in the background would keep
            // resetting its own clock and the lock would never actually engage.
            FilterResponses.writeJsonError(response, SESSION_LOCKED_STATUS, "Session locked due to inactivity");
            return;
        }

        activityStore.recordActivity(jti, now);
        chain.doFilter(request, response);
    }
}
