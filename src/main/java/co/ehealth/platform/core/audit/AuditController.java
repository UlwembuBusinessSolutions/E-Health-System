package co.ehealth.platform.core.audit;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.UUID;

@RestController
@Validated
public class AuditController {

    private final AuditLogRepository auditLogRepository;

    public AuditController(AuditLogRepository auditLogRepository) {
        this.auditLogRepository = auditLogRepository;
    }

    @GetMapping("/api/v1/audit-snapshots")
    public ResponseEntity<Page<AuditSnapshotResponse>> listAuditSnapshots(
            @RequestParam(defaultValue = "0") @Min(0) int page,
            @RequestParam(defaultValue = "20") @Min(1) @Max(100) int size) {
        PageRequest pageRequest = PageRequest.of(page, size, Sort.by("createdAt").descending());
        return ResponseEntity.ok(auditLogRepository.findAll(pageRequest).map(AuditSnapshotResponse::from));
    }

    @GetMapping("/api/v1/audit-snapshots/entity/{entityType}/{entityId}")
    public ResponseEntity<Page<AuditSnapshotResponse>> getAuditSnapshotsByEntity(
            @PathVariable String entityType, @PathVariable String entityId,
            @RequestParam(defaultValue = "0") @Min(0) int page,
            @RequestParam(defaultValue = "20") @Min(1) @Max(100) int size) {
        PageRequest pageRequest = PageRequest.of(page, size, Sort.by("createdAt").descending());
        return ResponseEntity.ok(auditLogRepository.findByEntityTypeAndEntityId(entityType, entityId, pageRequest)
                .map(AuditSnapshotResponse::from));
    }

    @GetMapping("/api/v1/audit-snapshots/{auditId}")
    public ResponseEntity<AuditSnapshotResponse> getAuditSnapshot(@PathVariable UUID auditId) {
        return auditLogRepository.findById(auditId)
                .map(audit -> ResponseEntity.ok(AuditSnapshotResponse.from(audit)))
                .orElse(ResponseEntity.notFound().build());
    }

    public record AuditSnapshotResponse(UUID id, UUID userId, UUID facilityId, String action, String entityType,
                                        String entityId, String beforeValue, String afterValue, String ipAddress,
                                        Instant createdAt) {
        static AuditSnapshotResponse from(AuditLog auditLog) {
            return new AuditSnapshotResponse(auditLog.getId(), auditLog.getUserId(), auditLog.getFacilityId(),
                    auditLog.getAction(), auditLog.getEntityType(), auditLog.getEntityId(), auditLog.getBeforeValue(),
                    auditLog.getAfterValue(), auditLog.getIpAddress(), auditLog.getCreatedAt());
        }
    }
}
