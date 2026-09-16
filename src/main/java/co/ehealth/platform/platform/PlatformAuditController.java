package co.ehealth.platform.platform;

import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/platform/audit")
public class PlatformAuditController {

    private final PlatformAuditService platformAuditService;

    public PlatformAuditController(PlatformAuditService platformAuditService) {
        this.platformAuditService = platformAuditService;
    }

    @GetMapping
    public ResponseEntity<Map<String, Object>> list(
            @RequestParam(required = false) String action,
            @RequestParam(required = false) UUID organizationId,
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
            LocalDate from,
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
            LocalDate to) {

        Instant fromInstant =
                from != null
                        ? from.atStartOfDay(ZoneOffset.UTC).toInstant()
                        : null;

        Instant toInstant =
                to != null
                        ? to.plusDays(1)
                                .atStartOfDay(ZoneOffset.UTC)
                                .toInstant()
                        : null;

        var items = platformAuditService.list(
                action,
                organizationId,
                fromInstant,
                toInstant);

        return ResponseEntity.ok(Map.of("items", items));
    }

    @GetMapping(
            value = "/export",
            produces = "text/csv")
    public ResponseEntity<byte[]> export(
            @RequestParam(required = false) String action,
            @RequestParam(required = false) UUID organizationId,
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
            LocalDate from,
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
            LocalDate to) {

        Instant fromInstant =
                from != null
                        ? from.atStartOfDay(ZoneOffset.UTC).toInstant()
                        : null;

        Instant toInstant =
                to != null
                        ? to.plusDays(1)
                                .atStartOfDay(ZoneOffset.UTC)
                                .toInstant()
                        : null;

        UUID exportingOperatorId = null;

        PlatformAuditService.AuditExport export =
                platformAuditService.exportCsv(
                        action,
                        organizationId,
                        fromInstant,
                        toInstant,
                        exportingOperatorId);

        return ResponseEntity.ok()
                .header(
                        HttpHeaders.CONTENT_DISPOSITION,
                        "attachment; filename=\"platform-audit.csv\"")
                .contentType(MediaType.parseMediaType("text/csv"))
                .contentLength(export.content().length)
                .body(export.content());
    }
}