package co.ehealth.platform.core.audit;

import co.ehealth.platform.core.common.RequestMetadata;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;

import java.time.Clock;
import java.util.List;
import java.util.UUID;

@Service
public class AuditLogService {

    private final AuditLogRepository auditLogRepository;
    private final Clock clock;

    public AuditLogService(AuditLogRepository auditLogRepository, Clock clock) {
        this.auditLogRepository = auditLogRepository;
        this.clock = clock;
    }

    // The read half — audit_log lives in whichever schema TenantContext
    // currently points at (TenantIdentifierResolver), so the caller is
    // responsible for having set that before calling this, same discipline
    // every other tenant-schema read in this codebase already follows
    // (OrganizationProvisioningService.listAdmins(), for one). No filters
    // yet — AUDT-US-005's full filter set lives on the platform-side audit
    // view (PlatformAuditService); this is one organization's own trail,
    // naturally small enough that a chronological list is enough for now.
    public List<AuditLog> listAll() {
        return auditLogRepository.findAll(Sort.by(Sort.Direction.DESC, "createdAt"));
    }

    // The single write path for audit rows — every module calls this
    // rather than constructing AuditLog entities directly. ipAddress and
    // deviceSignature are no longer caller-supplied parameters — they're
    // read straight off the current request here (RequestMetadata's own
    // why-note on why that replaced manually threading
    // HttpServletRequest.getRemoteAddr() through every call chain). Both
    // come back null outside a real HTTP request (background jobs, the
    // dev seed-data runner), which every reader of this table already
    // treats as legitimate.
    public void append(UUID userId, UUID facilityId, String action, String entityType, String entityId,
                        String beforeValue, String afterValue) {
        auditLogRepository.save(new AuditLog(userId, facilityId, action, entityType, entityId,
                beforeValue, afterValue, RequestMetadata.currentIpAddress(), RequestMetadata.currentUserAgent(),
                clock.instant()));
    }
}
