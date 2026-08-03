package co.ehealth.platform.core.audit;

import org.springframework.stereotype.Service;

import java.time.Clock;
import java.util.UUID;

@Service
public class AuditLogService {

    private final AuditLogRepository auditLogRepository;
    private final Clock clock;

    public AuditLogService(AuditLogRepository auditLogRepository, Clock clock) {
        this.auditLogRepository = auditLogRepository;
        this.clock = clock;
    }

    // The single write path for audit rows — every module calls this
    // rather than constructing AuditLog entities directly. ipAddress is
    // nullable: some callers (background jobs, the platform-provisioning
    // path before a tenant request context exists) genuinely have none to
    // give.
    public void append(UUID userId, UUID facilityId, String action, String entityType, String entityId,
                        String beforeValue, String afterValue, String ipAddress) {
        auditLogRepository.save(new AuditLog(userId, facilityId, action, entityType, entityId,
                beforeValue, afterValue, ipAddress, clock.instant()));
    }
}
