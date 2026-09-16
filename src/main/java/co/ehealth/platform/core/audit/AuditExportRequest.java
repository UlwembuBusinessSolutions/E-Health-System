package co.ehealth.platform.core.audit;

import co.ehealth.platform.core.tenant.ModuleCode;

import java.time.Instant;
import java.util.UUID;

public record AuditExportRequest(
        Instant from,
        Instant to,
        UUID userId,
        String action,
        ModuleCode module,
        String entityId,
        Boolean privileged) {
}
