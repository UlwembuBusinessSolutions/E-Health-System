package co.ehealth.platform.core.audit;

import co.ehealth.platform.core.tenant.ModuleCode;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

// AUDT-US-006 / AUDT-US-007.
// The tenant is deliberately absent from this route and its response:
// TenantFilter selects the schema before this controller runs.
@RestController
@RequestMapping("/api/v1/admin/audit")
public class AuditController {

    private final AuditLogService auditLogService;

    public AuditController(AuditLogService auditLogService) {
        this.auditLogService = auditLogService;
    }

    /**
     * Read-only audit trail endpoint.
     *
     * There are deliberately no POST, PUT, PATCH or DELETE endpoints
     * for audit records.
     */
    @GetMapping
    public ResponseEntity<Map<String, Object>> list() {

        List<AuditEntry> items = auditLogService
                .listAll()
                .stream()
                .map(AuditEntry::from)
                .toList();

        return ResponseEntity.ok(Map.of("items", items));
    }

    /**
     * AUDT-US-007.
     *
     * Exports the audit records selected by the supplied filters as CSV.
     */
    @GetMapping(
            value = "/export",
            produces = "text/csv")
    public ResponseEntity<byte[]> export(
            @RequestParam(required = false) Instant from,
            @RequestParam(required = false) Instant to,
            @RequestParam(required = false) UUID userId,
            @RequestParam(required = false) String action,
            @RequestParam(required = false) ModuleCode module,
            @RequestParam(required = false) String entityId,
            @RequestParam(required = false) Boolean privileged) {

        AuditLogService.AuditLogSearchCriteria criteria =
                new AuditLogService.AuditLogSearchCriteria(
                        from,
                        to,
                        userId,
                        action,
                        module,
                        entityId,
                        privileged);

        AuditLogService.AuditExport export =
                auditLogService.exportCsv(criteria);

        String filename =
                "audit-export-"
                        + export.generatedAt()
                        .toString()
                        .replace(":", "-")
                        + ".csv";

        HttpHeaders headers = new HttpHeaders();

        headers.setContentType(
                MediaType.parseMediaType("text/csv"));

        headers.setContentDisposition(
                ContentDisposition
                        .attachment()
                        .filename(filename)
                        .build());

        headers.setContentLength(export.content().length);

        return ResponseEntity
                .ok()
                .headers(headers)
                .body(export.content());
    }

    public record AuditEntry(
            UUID id,
            UUID userId,
            UUID facilityId,
            String action,
            String entityType,
            String entityId,
            String beforeValue,
            String afterValue,
            String ipAddress,
            String deviceSignature,
            boolean privileged,
            Long auditSequence,
            String previousHash,
            String integrityHash,
            Instant createdAt) {

        static AuditEntry from(AuditLog row) {

            return new AuditEntry(
                    row.getId(),
                    row.getUserId(),
                    row.getFacilityId(),
                    row.getAction(),
                    row.getEntityType(),
                    row.getEntityId(),
                    row.getBeforeValue(),
                    row.getAfterValue(),
                    row.getIpAddress(),
                    row.getDeviceSignature(),
                    row.isPrivileged(),
                    row.getAuditSequence(),
                    row.getPreviousHash(),
                    row.getIntegrityHash(),
                    row.getCreatedAt());
        }
    }
}
