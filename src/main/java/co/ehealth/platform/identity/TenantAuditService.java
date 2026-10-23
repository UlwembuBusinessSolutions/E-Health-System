package co.ehealth.platform.identity;

import co.ehealth.platform.core.audit.AuditLog;
import co.ehealth.platform.core.audit.AuditLogService;
import org.springframework.data.domain.Page;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

// The tenant-side counterpart to OrganizationProvisioningService's own
// listTenantAuditLog()/listTenantAuditLogForExport() — that pair is a
// platform operator looking in at one org from the outside (schema
// switched by hand via TenantContext); this is that org's own ORG_ADMIN
// looking at their own trail from inside a request TenantFilter already
// scoped, so there's no TenantContext.setCurrentTenant()/clear() dance
// here — AuditLogService.list() already reads whichever schema the
// current request is already in.
@Service
public class TenantAuditService {

    private final AuditLogService auditLogService;
    private final StaffService staffService;

    public TenantAuditService(AuditLogService auditLogService, StaffService staffService) {
        this.auditLogService = auditLogService;
        this.staffService = staffService;
    }

    public TenantAuditPage list(int page, int size, Instant from, Instant to) {
        Page<AuditLog> resultPage = auditLogService.list(page, size, from, to);
        List<TenantAuditEntryView> items = toViews(resultPage.getContent());
        return new TenantAuditPage(items, resultPage.getNumber(), resultPage.getSize(),
                resultPage.getTotalElements(), resultPage.hasNext());
    }

    // The entire trail matching the caller's date range, not one page —
    // same EXPORT_MAX_ROWS cap as every other CSV export in this codebase.
    // Records its own AUDIT_LOG_EXPORTED row once the export's own read
    // has already run, so — like PLATFORM_AUDIT_EXPORTED/
    // ORGANIZATION_AUDIT_EXPORTED before it — the export never lists
    // itself.
    public List<TenantAuditEntryView> listForExport(UUID actingUserId, Instant from, Instant to) {
        List<AuditLog> rows = auditLogService.listAllForExport(from, to);
        List<TenantAuditEntryView> items = toViews(rows);
        auditLogService.append(actingUserId, null, "AUDIT_LOG_EXPORTED", "AuditLog", "*", null,
                "{\"rows\":%d}".formatted(rows.size()));
        return items;
    }

    private List<TenantAuditEntryView> toViews(List<AuditLog> rows) {
        Set<UUID> userIds = rows.stream().map(AuditLog::getUserId).filter(Objects::nonNull)
                .collect(Collectors.toSet());
        Map<UUID, String> namesByUserId = staffService.resolveUserNames(userIds);
        return rows.stream().map(row -> new TenantAuditEntryView(
                row.getId(), row.getAction(), row.getEntityType(), row.getEntityId(), row.getCreatedAt(),
                namesByUserId.getOrDefault(row.getUserId(), "Unknown user"),
                row.getBeforeValue(), row.getAfterValue(),
                row.getIpAddress(), row.getDeviceSignature())).toList();
    }

    public record TenantAuditEntryView(
            UUID id, String action, String entityType, String entityId, Instant createdAt, String actorName,
            String beforeValue, String afterValue, String ipAddress, String deviceSignature) {
    }

    public record TenantAuditPage(List<TenantAuditEntryView> items, int page, int size, long totalItems,
                                   boolean hasMore) {
    }
}
