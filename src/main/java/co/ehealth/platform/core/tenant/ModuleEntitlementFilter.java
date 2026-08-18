package co.ehealth.platform.core.tenant;


import co.ehealth.platform.core.common.FilterResponses;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Map;

/**
 * Filter that enforces module entitlements at the request level.
 *
 * <p>
 * Each request path prefix is mapped to the module that owns it.
 * If the module is disabled for the current tenant, the request
 * is blocked with a 403 Forbidden response.
 * </p>
 */
public class ModuleEntitlementFilter extends OncePerRequestFilter {

    // Maps a request path prefix to the module that owns it.
    // Extend this as each module's real routes are built.
    private static final Map<String, ModuleCode> ROUTE_MODULE_MAP = Map.of(
            "/api/v1/patients", ModuleCode.PREG
    );

    private final ModuleEntitlementCache entitlementCache; // see Step 8

    public ModuleEntitlementFilter(ModuleEntitlementCache entitlementCache) {
        this.entitlementCache = entitlementCache;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain chain)
            throws ServletException, IOException {

        ModuleCode moduleCode = resolveModule(request.getRequestURI());

        // No mapped module (foundation routes or not gated yet) — always allowed.
        if (moduleCode == null || moduleCode.isFoundation()) {
            chain.doFilter(request, response);
            return;
        }

        String schemaName = TenantContext.getCurrentTenant(); // set by TenantFilter
        if (!entitlementCache.isEnabled(schemaName, moduleCode)) {
            FilterResponses.writeJsonError(response,
                    HttpServletResponse.SC_FORBIDDEN,
                    moduleCode + " is not enabled for this organization");
            return;
        }

        chain.doFilter(request, response);
    }

    private ModuleCode resolveModule(String uri) {
        return ROUTE_MODULE_MAP.entrySet().stream()
                .filter(e -> uri.startsWith(e.getKey()))
                .map(Map.Entry::getValue)
                .findFirst()
                .orElse(null);
    }
}
