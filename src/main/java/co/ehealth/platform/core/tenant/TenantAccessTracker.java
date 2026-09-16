package co.ehealth.platform.core.tenant;

import java.util.LinkedHashSet;
import java.util.Set;

public final class TenantAccessTracker {

    private static final ThreadLocal<Set<String>> TOUCHED_SCHEMAS = ThreadLocal.withInitial(LinkedHashSet::new);

    private TenantAccessTracker() {
    }

    static void record(String schemaName) {
        TOUCHED_SCHEMAS.get().add(schemaName);
    }

    public static Set<String> getTouchedSchemas() {
        return Set.copyOf(TOUCHED_SCHEMAS.get());
    }

    public static void reset() {
        TOUCHED_SCHEMAS.remove();
    }
}