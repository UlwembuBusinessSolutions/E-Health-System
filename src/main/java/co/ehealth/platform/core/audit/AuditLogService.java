package co.ehealth.platform.core.audit;

import co.ehealth.platform.core.common.RequestMetadata;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;

import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Service
public class AuditLogService {

    public static final int DEFAULT_PAGE_SIZE = 50;
    public static final int MAX_PAGE_SIZE = 100;
    // Same reasoning as PlatformAuditService.EXPORT_MAX_ROWS — CSV export
    // needs the whole trail, not one page, bounded so a genuinely huge
    // org's full history doesn't turn into an unbounded synchronous query.
    public static final int EXPORT_MAX_ROWS = 10_000;

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
    // view (PlatformAuditService); this is one organization's own trail.
    // Bounded, unlike the previous unlimited listAll() this replaced — an
    // established org's trail is no longer "naturally small" after enough
    // calendar time.
    public Page<AuditLog> list(int page, int size) {
        return list(page, size, null, null);
    }

    // The date-filtered form — TenantAuditController's own default of
    // "just today" unless the caller widens it (its own why-note on why
    // that default exists: an established org's trail can run to
    // thousands of rows, and loading all of them on every page open was
    // the exact "maybe loadings" problem this filter exists to prevent).
    // listTenantAuditLog() (OrganizationProvisioningService) keeps calling
    // the unfiltered overload above — a platform operator inspecting one
    // org's whole history from outside it has no "today" to default to.
    public Page<AuditLog> list(int page, int size, Instant from, Instant to) {
        int boundedSize = Math.min(Math.max(size, 1), MAX_PAGE_SIZE);
        Pageable pageable = PageRequest.of(Math.max(page, 0), boundedSize, Sort.by(Sort.Direction.DESC, "createdAt"));
        return auditLogRepository.findAll(buildDateSpec(from, to), pageable);
    }

    // The CSV export's read half — this organization's entire trail
    // (matching whatever date range the caller filtered to), not just
    // whichever page was last open.
    public List<AuditLog> listAllForExport() {
        return listAllForExport(null, null);
    }

    public List<AuditLog> listAllForExport(Instant from, Instant to) {
        Pageable pageable = PageRequest.of(0, EXPORT_MAX_ROWS, Sort.by(Sort.Direction.DESC, "createdAt"));
        return auditLogRepository.findAll(buildDateSpec(from, to), pageable).getContent();
    }

    private Specification<AuditLog> buildDateSpec(Instant from, Instant to) {
        Specification<AuditLog> spec = Specification.where(null);
        if (from != null) {
            spec = spec.and((root, cq, cb) -> cb.greaterThanOrEqualTo(root.get("createdAt"), from));
        }
        if (to != null) {
            // Exclusive, same reasoning as PlatformAuditService.buildSpec()'s
            // own why-note — `to` is already the start of the day AFTER the
            // requested end date.
            spec = spec.and((root, cq, cb) -> cb.lessThan(root.get("createdAt"), to));
        }
        return spec;
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
