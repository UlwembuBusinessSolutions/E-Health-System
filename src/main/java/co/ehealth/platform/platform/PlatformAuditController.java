package co.ehealth.platform.platform;

import co.ehealth.platform.core.common.CsvExport;
import co.ehealth.platform.core.security.PlatformOperatorPrincipal;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;
import java.util.UUID;

// AUDT-US-005's platform-side counterpart. SecurityConfig's own
// /platform/** -> hasRole("PLATFORM_OPERATOR") rule is the entire
// authorization check here — every platform operator sees every org's
// platform-level activity, matching how the rest of the platform console
// already works (there's no per-operator scoping anywhere else in it
// either).
@RestController
@RequestMapping("/platform/audit")
public class PlatformAuditController {

    private final PlatformAuditService platformAuditService;
    private final PlatformAuditLogRepository platformAuditLogRepository;
    private final Clock clock;

    public PlatformAuditController(PlatformAuditService platformAuditService,
                                    PlatformAuditLogRepository platformAuditLogRepository, Clock clock) {
        this.platformAuditService = platformAuditService;
        this.platformAuditLogRepository = platformAuditLogRepository;
        this.clock = clock;
    }

    // from/to are calendar dates, not instants — a compliance officer
    // filtering "1 Aug to 15 Aug" thinks in whole days, not UTC timestamps.
    // from is midnight that day; to is midnight the NEXT day, so the whole
    // end date is included rather than silently excluding everything after
    // 00:00:00 on it.
    @GetMapping
    public ResponseEntity<Map<String, Object>> list(
            @RequestParam(required = false) String action,
            @RequestParam(required = false) UUID organizationId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(required = false, defaultValue = "0") int page,
            @RequestParam(required = false, defaultValue = "50") int size) {
        Instant fromInstant = from != null ? from.atStartOfDay(ZoneOffset.UTC).toInstant() : null;
        Instant toInstant = to != null ? to.plusDays(1).atStartOfDay(ZoneOffset.UTC).toInstant() : null;
        var result = platformAuditService.list(action, organizationId, fromInstant, toInstant, page, size);
        return ResponseEntity.ok(Map.of("items", result.items(), "page", result.page(), "size", result.size(),
                "totalItems", result.totalItems(), "hasMore", result.hasMore()));
    }

    // The entire filtered result, not one page of it (PlatformAuditService.
    // listAllForExport()'s own why-note on the cap this is subject to).
    // Same filters as GET above, no page/size — export has no pages.
    // Recorded as its own platform_audit_log row (requester, filter
    // snapshot, result count) written directly here rather than through
    // PlatformAuditService, which is deliberately read-only by construction
    // (its own class-level why-note) — export is a write, so it goes
    // through the same direct-repository-save path PlatformAuthService and
    // PlatformOperatorService already use for every other platform_audit_log
    // row.
    @GetMapping("/export")
    public ResponseEntity<byte[]> export(
            @RequestParam(required = false) String action,
            @RequestParam(required = false) UUID organizationId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @AuthenticationPrincipal PlatformOperatorPrincipal operator) {
        Instant fromInstant = from != null ? from.atStartOfDay(ZoneOffset.UTC).toInstant() : null;
        Instant toInstant = to != null ? to.plusDays(1).atStartOfDay(ZoneOffset.UTC).toInstant() : null;
        List<PlatformAuditService.PlatformAuditEntryView> items =
                platformAuditService.listAllForExport(action, organizationId, fromInstant, toInstant);

        List<String> header = List.of("When (UTC)", "Action", "Organization", "Operator", "Operator email",
                "Detail", "IP address", "Device");
        List<List<String>> rows = items.stream().map(item -> List.of(
                CsvExport.cell(item.createdAt()),
                CsvExport.cell(item.action()),
                CsvExport.cell(item.organizationName()),
                CsvExport.cell(item.operatorName()),
                CsvExport.cell(item.operatorEmail()),
                CsvExport.cell(item.detail()),
                CsvExport.cell(item.ipAddress()),
                CsvExport.cell(item.deviceSignature()))).toList();
        byte[] csv = CsvExport.toCsv(header, rows).getBytes(StandardCharsets.UTF_8);

        String detail = "action=%s; organizationId=%s; from=%s; to=%s; rows=%d".formatted(
                action == null ? "any" : action, organizationId, from, to, items.size());
        platformAuditLogRepository.save(new PlatformAuditLog(operator.operatorId(), "PLATFORM_AUDIT_EXPORTED", null,
                detail, clock.instant()));

        String filename = "platform-audit-" + DateTimeFormatter.ofPattern("yyyyMMdd-HHmmss")
                .withZone(ZoneOffset.UTC).format(clock.instant()) + ".csv";
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment().filename(filename).build().toString())
                .contentType(MediaType.parseMediaType("text/csv;charset=UTF-8"))
                .body(csv);
    }
}
