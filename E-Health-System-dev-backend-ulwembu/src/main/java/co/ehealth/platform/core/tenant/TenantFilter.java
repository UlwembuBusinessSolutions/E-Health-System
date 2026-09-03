package co.ehealth.platform.core.tenant;

import co.ehealth.platform.core.common.FilterResponses;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.CorsProcessor;
import org.springframework.web.cors.CorsUtils;
import org.springframework.web.cors.DefaultCorsProcessor;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Optional;

// Deliberately not a @Component — it's registered explicitly (see
// TenantFilterConfig) so its position ahead of Spring Security's own
// filter chain is unambiguous, instead of two auto-registered filters
// racing on order.
public class TenantFilter extends OncePerRequestFilter {

    private static final String TENANT_HEADER = "X-Tenant-ID";

    private final OrganizationLookupService organizationLookupService;
    // Same CorsConfigurationSource SecurityConfig's own filter chain uses.
    // TenantFilter sits ahead of that chain (HIGHEST_PRECEDENCE, see
    // TenantFilterConfig), so any early rejection written here
    // (writeJsonError + return, no chain.doFilter()) never reaches Spring
    // Security's own CorsFilter — the response would go out with no
    // Access-Control-Allow-Origin header, and a real browser silently
    // blocks it as a CORS violation rather than letting the caller's JS
    // read the actual 403/404 body. curl doesn't enforce CORS at all, so
    // this was invisible to every curl-based check; found by testing a
    // suspended-tenant login in a real browser. Applying the same CORS
    // decision Spring Security's own chain would have made, manually,
    // before any early-exit write below.
    private final CorsProcessor corsProcessor = new DefaultCorsProcessor();
    private final CorsConfigurationSource corsConfigurationSource;

    public TenantFilter(OrganizationLookupService organizationLookupService,
                         CorsConfigurationSource corsConfigurationSource) {
        this.organizationLookupService = organizationLookupService;
        this.corsConfigurationSource = corsConfigurationSource;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        if (CorsUtils.isCorsRequest(request)) {
            CorsConfiguration corsConfiguration = corsConfigurationSource.getCorsConfiguration(request);
            if (!corsProcessor.processRequest(corsConfiguration, request, response)) {
                return;
            }
        }
        try {
            String slug = resolveTenantSlug(request);
            Optional<Organization> organization = slug != null
                    ? organizationLookupService.findBySlug(slug)
                    : Optional.empty();

            if (organization.isEmpty()) {
                // An unresolved tenant reads as "this address doesn't
                // exist," not "bad request" — a typo'd subdomain and an
                // unknown one look identical from the caller's side.
                FilterResponses.writeJsonError(response, HttpServletResponse.SC_NOT_FOUND, "Unknown tenant");
                return;
            }

            // SADM-US-003's own acceptance criteria: a suspended tenant's
            // users are denied login "with a clear suspended-account
            // message," not the same opaque "Unknown tenant" a typo'd slug
            // gets. Deliberately distinct from that case — a tenant slug
            // isn't treated as secret anywhere else in this system (it's
            // the thing every login URL is built from), so confirming one
            // exists-but-is-suspended isn't a meaningful new disclosure the
            // way, say, confirming a specific email has an account would
            // be (AuthService.login()'s own enumeration guard).
            if (organization.get().getStatus() != OrganizationStatus.ACTIVE) {
                FilterResponses.writeJsonError(response, HttpServletResponse.SC_FORBIDDEN,
                        "This organization has been suspended. Contact your platform administrator.");
                return;
            }

            TenantContext.setCurrentTenant(organization.get().getSchemaName());
            chain.doFilter(request, response);
        } finally {
            TenantContext.clear();
        }
    }

    private String resolveTenantSlug(HttpServletRequest request) {
        String header = request.getHeader(TENANT_HEADER);
        if (header != null && !header.isBlank()) {
            return header.trim();
        }
        String host = request.getServerName(); // cot.ehealth.example.com -> "cot"
        int firstDot = host.indexOf('.');
        return firstDot > 0 ? host.substring(0, firstDot) : null;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        // /platform/** creates the organization this filter exists to
        // resolve — there is no tenant to find yet, by definition, so
        // resolving one here would 404 every provisioning request before
        // PlatformJwtAuthenticationFilter even gets a chance to run.
        //
        // A CORS preflight (OPTIONS) request never carries X-Tenant-ID —
        // browsers strip custom headers from preflight requests by design,
        // only announcing them via Access-Control-Request-Headers — and
        // this filter sits at Ordered.HIGHEST_PRECEDENCE, ahead of Spring
        // Security's own filter chain and its CorsFilter. Without this
        // check, every preflight against a tenant-scoped endpoint resolved
        // no tenant and 404'd here, before Spring Security's CORS handling
        // ever got a chance to answer it — which meant no real browser
        // could successfully call this API cross-origin at all, for any
        // endpoint under a tenant. Confirmed by testing with a real
        // preflight request, not found by reading the filter in isolation.
        String uri = request.getRequestURI();
        return uri.startsWith("/actuator/health") || uri.startsWith("/platform/")
                // The tenant register is a platform-operator view. It has no
                // tenant header by design, so attempting tenant resolution
                // here would reject it before its own security rule runs.
                || uri.startsWith("/api/v1/tenants")
                || "OPTIONS".equalsIgnoreCase(request.getMethod());
    }
}
