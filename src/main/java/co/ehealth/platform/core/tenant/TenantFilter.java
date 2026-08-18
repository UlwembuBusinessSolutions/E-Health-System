package co.ehealth.platform.core.tenant;

import co.ehealth.platform.core.common.FilterResponses;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
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

    public TenantFilter(OrganizationLookupService organizationLookupService) {
        this.organizationLookupService = organizationLookupService;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        try {
            String slug = resolveTenantSlug(request);
            Optional<Organization> organization = slug != null
                    ? organizationLookupService.findActiveBySlug(slug)
                    : Optional.empty();

            if (organization.isEmpty()) {
                // An unresolved tenant reads as "this address doesn't
                // exist," not "bad request" — a typo'd subdomain and an
                // unknown one look identical from the caller's side.
                FilterResponses.writeJsonError(response, HttpServletResponse.SC_NOT_FOUND, "Unknown tenant");
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
                || "OPTIONS".equalsIgnoreCase(request.getMethod());
    }
}
