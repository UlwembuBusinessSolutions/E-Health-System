// package co.ehealth.platform.core.tenant;

// // Request-scoped current tenant schema name. Read-only outside this
// // package by convention — TenantFilter is the only thing that ever calls
// // setCurrentTenant()/clear() as part of the normal request lifecycle;
// // OrganizationProvisioningService is the one deliberate exception, since it
// // runs before any request has been routed to a tenant at all.
// public final class TenantContext {

//     private static final ThreadLocal<String> CURRENT_TENANT = new ThreadLocal<>();

//     private TenantContext() {
//     }

//     public static void setCurrentTenant(String schemaName) {
//         CURRENT_TENANT.set(schemaName);
//     }

//     public static String getCurrentTenant() {
//         return CURRENT_TENANT.get();
//     }

//     public static void clear() {
//         CURRENT_TENANT.remove();
//     }
// }

package co.ehealth.platform.core.tenant;

public final class TenantContext {

    private static final ThreadLocal<String> CURRENT_TENANT = new ThreadLocal<>();

    private TenantContext() {
    }

    public static void setCurrentTenant(String schemaName) {
        CURRENT_TENANT.set(schemaName);
        TenantAccessTracker.record(schemaName);
    }

    public static String getCurrentTenant() {
        return CURRENT_TENANT.get();
    }

    public static void clear() {
        CURRENT_TENANT.remove();
    }
}
