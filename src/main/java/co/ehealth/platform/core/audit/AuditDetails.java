package co.ehealth.platform.core.audit;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.util.LinkedHashMap;
import java.util.Map;

// Builds the JSON text AuditLogService.append() stores in its before/after
// columns. Those columns are JSONB, so a plain string like "quantity=5" is
// rejected by the database and would roll back the business action that was
// only trying to leave a trace — always build the value through here.
public final class AuditDetails {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    private AuditDetails() {
    }

    // of("quantity", 5, "lot", "A1") -> {"quantity":5,"lot":"A1"}
    public static String of(Object... keysAndValues) {
        if (keysAndValues.length % 2 != 0) {
            throw new IllegalArgumentException("AuditDetails.of needs key/value pairs");
        }
        Map<String, Object> details = new LinkedHashMap<>();
        for (int i = 0; i < keysAndValues.length; i += 2) {
            details.put(String.valueOf(keysAndValues[i]), keysAndValues[i + 1]);
        }
        try {
            return MAPPER.writeValueAsString(details);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Failed to serialise audit details", e);
        }
    }
}
