package co.ehealth.platform.identity;

import co.ehealth.platform.core.audit.AuditLog;
import co.ehealth.platform.core.audit.AuditLogService;
import co.ehealth.platform.core.tenant.ModuleCode;

import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@RestController
public class TenantAuditController {

    private final AuditLogService auditLogService;
    private final StaffService staffService;
    private final PermissionService permissionService;

    public TenantAuditController(AuditLogService auditLogService, StaffService staffService,
            PermissionService permissionService) {
        this.auditLogService = auditLogService;
        this.staffService = staffService;
        this.permissionService = permissionService;
    }

    // @GetMapping("/api/v1/audit")
    // public ResponseEntity<Map<String, Object>> list(
    // @RequestParam(required = false) @DateTimeFormat(iso =
    // DateTimeFormat.ISO.DATE) LocalDate from,
    // @RequestParam(required = false) @DateTimeFormat(iso =
    // DateTimeFormat.ISO.DATE) LocalDate to,
    // @RequestParam(required = false) UUID userId,
    // @RequestParam(required = false) String action,
    // @RequestParam(required = false) ModuleCode module,
    // @RequestParam(required = false) String entityId) {

    // permissionService.requireAccess(ModuleCode.AUDT, PermissionLevel.VIEW);

    // Instant fromInstant = from != null ?
    // from.atStartOfDay(ZoneOffset.UTC).toInstant() : null;
    // Instant toInstant = to != null ?
    // to.plusDays(1).atStartOfDay(ZoneOffset.UTC).toInstant() : null;

    // List<AuditLog> rows = auditLogService.search(
    // new AuditLogService.AuditLogSearchCriteria(fromInstant, toInstant, userId,
    // action, module, entityId));

    // Set<UUID> userIds =
    // rows.stream().map(AuditLog::getUserId).filter(Objects::nonNull)
    // .collect(Collectors.toSet());
    // Map<UUID, String> namesByUserId = staffService.resolveUserNames(userIds);

    // List<AuditEntryResponse> items = rows.stream()
    // .map(row -> AuditEntryResponse.from(row,
    // namesByUserId.getOrDefault(row.getUserId(), "Unknown user")))
    // .toList();
    // return ResponseEntity.ok(Map.of("items", items));
    // }

    // public record AuditEntryResponse(UUID id, String action, String entityType,
    // String entityId, Instant createdAt,
    // UUID userId, String userName, UUID facilityId, String beforeValue,
    // String afterValue, String ipAddress, String deviceSignature) {
    // static AuditEntryResponse from(AuditLog row, String userName) {
    // return new AuditEntryResponse(row.getId(), row.getAction(),
    // row.getEntityType(), row.getEntityId(),
    // row.getCreatedAt(), row.getUserId(), userName, row.getFacilityId(),
    // row.getBeforeValue(),
    // row.getAfterValue(), row.getIpAddress(), row.getDeviceSignature());
    // }
    // }

    @GetMapping("/api/v1/audit")
    public ResponseEntity<Map<String, Object>> list(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(required = false) UUID userId,
            @RequestParam(required = false) String action,
            @RequestParam(required = false) ModuleCode module,
            @RequestParam(required = false) String entityId,
            @RequestParam(required = false) Boolean privileged) {
        permissionService.requireAccess(ModuleCode.AUDT, PermissionLevel.VIEW);

        Instant fromInstant = from != null ? from.atStartOfDay(ZoneOffset.UTC).toInstant() : null;
        Instant toInstant = to != null ? to.plusDays(1).atStartOfDay(ZoneOffset.UTC).toInstant() : null;

        List<AuditLog> rows = auditLogService.search(
                new AuditLogService.AuditLogSearchCriteria(fromInstant, toInstant, userId, action, module, entityId,
                        privileged));

        Set<UUID> userIds = rows.stream().map(AuditLog::getUserId).filter(Objects::nonNull).collect(Collectors.toSet());
        Map<UUID, String> namesByUserId = staffService.resolveUserNames(userIds);

        List<AuditEntryResponse> items = rows.stream()
                .map(row -> AuditEntryResponse.from(row, namesByUserId.getOrDefault(row.getUserId(), "Unknown user")))
                .toList();
        return ResponseEntity.ok(Map.of("items", items));
    }

    public record AuditEntryResponse(UUID id, String action, String entityType, String entityId, Instant createdAt,
            UUID userId, String userName, UUID facilityId, boolean privileged,
            String beforeValue, String afterValue, String ipAddress, String deviceSignature) {
        static AuditEntryResponse from(AuditLog row, String userName) {
            return new AuditEntryResponse(row.getId(), row.getAction(), row.getEntityType(), row.getEntityId(),
                    row.getCreatedAt(), row.getUserId(), userName, row.getFacilityId(), row.isPrivileged(),
                    row.getBeforeValue(), row.getAfterValue(), row.getIpAddress(), row.getDeviceSignature());
        }
    }
}