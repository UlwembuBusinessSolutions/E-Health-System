package co.ehealth.platform.core.audit;

import org.springframework.stereotype.Service;

import java.time.Clock;
import java.util.UUID;

@Service
public class AuditLogService {

    private final AuditLogRepository auditLogRepository;
    private final Clock clock;

    public AuditLogService(
            AuditLogRepository auditLogRepository,
            Clock clock
    ) {
        this.auditLogRepository = auditLogRepository;
        this.clock = clock;
    }

    public void append(
            UUID userId,
            UUID facilityId,
            String action,
            String entityType,
            String entityId,
            String beforeValue,
            String afterValue,
            String ipAddress
    ) {
        auditLogRepository.save(
                new AuditLog(
                        userId,
                        facilityId,
                        action,
                        entityType,
                        entityId,
                        beforeValue,
                        afterValue,
                        ipAddress,
                        clock.instant()
                )
        );
    }
}