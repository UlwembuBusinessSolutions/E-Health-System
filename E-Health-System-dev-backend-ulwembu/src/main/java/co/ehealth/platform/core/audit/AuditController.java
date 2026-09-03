package co.ehealth.platform.core.audit;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

// AUDT-US-006.  The tenant is deliberately absent from this route and its
// response: TenantFilter selected the schema from the request before this
// controller runs, so there is no client-controlled tenant identifier that
// could be used to select another organisation's audit_log table.
@RestController
@RequestMapping("/api/v1/admin/audit")
public class AuditController {

    private final AuditLogService auditLogService;

    public AuditController(AuditLogService auditLogService) {
        this.auditLogService = auditLogService;
    }

    // SecurityConfig protects /api/v1/admin/** with ORG_ADMIN.  Returning a
    // DTO keeps the JPA entity (and any future internal fields) out of the
    // public contract while preserving the complete compliance event data.
    @GetMapping
    public ResponseEntity<Map<String, Object>> list() {
        List<AuditEntry> items = auditLogService.listAll().stream().map(AuditEntry::from).toList();
        return ResponseEntity.ok(Map.of("items", items));
    }

    public record AuditEntry(UUID id, UUID userId, UUID facilityId, String action, String entityType,
                             String entityId, String beforeValue, String afterValue, String ipAddress,
                             String deviceSignature, Instant createdAt) {
        static AuditEntry from(AuditLog row) {
            return new AuditEntry(row.getId(), row.getUserId(), row.getFacilityId(), row.getAction(),
                    row.getEntityType(), row.getEntityId(), row.getBeforeValue(), row.getAfterValue(),
                    row.getIpAddress(), row.getDeviceSignature(), row.getCreatedAt());
        }
    }
}
