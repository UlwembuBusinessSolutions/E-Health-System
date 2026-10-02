package co.ehealth.platform.identity;

import co.ehealth.platform.core.common.CsvExport;
import co.ehealth.platform.core.security.AuthenticatedPrincipal;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
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

// Covered by SecurityConfig's existing /api/v1/admin/** -> ORG_ADMIN
// matcher, same as StaffController — an org's own audit trail is admin
// territory for the same reason its staff roster is: everything here is
// this tenant's own activity, never another organization's (there's no
// organizationId path variable to get wrong, unlike PlatformController's
// platform-side equivalent — TenantContext already scoped this request
// to one schema before this controller ever runs).
@RestController
public class TenantAuditController {

    private final TenantAuditService tenantAuditService;
    private final Clock clock;

    public TenantAuditController(TenantAuditService tenantAuditService, Clock clock) {
        this.tenantAuditService = tenantAuditService;
        this.clock = clock;
    }

    // from/to are calendar dates, not instants — same reasoning as
    // PlatformAuditController's own why-note: a whole-days filter, not a
    // UTC-timestamp one. from is midnight that day; to is midnight the
    // NEXT day, so the whole end date is included. The frontend defaults
    // both to "today" on first load — a fresh trail can run to thousands
    // of rows, and loading every one of them on every page open is
    // exactly the "maybe loadings" this filter exists to avoid — but
    // either can be cleared to widen the range, and both are optional
    // here so a direct API caller isn't forced into that default.
    @GetMapping("/api/v1/admin/audit")
    public ResponseEntity<Map<String, Object>> list(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(required = false, defaultValue = "0") int page,
            @RequestParam(required = false, defaultValue = "50") int size) {
        Instant fromInstant = from != null ? from.atStartOfDay(ZoneOffset.UTC).toInstant() : null;
        Instant toInstant = to != null ? to.plusDays(1).atStartOfDay(ZoneOffset.UTC).toInstant() : null;
        TenantAuditService.TenantAuditPage result = tenantAuditService.list(page, size, fromInstant, toInstant);
        return ResponseEntity.ok(Map.of("items", result.items(), "page", result.page(), "size", result.size(),
                "totalItems", result.totalItems(), "hasMore", result.hasMore()));
    }

    // The entire filtered result, not one page — TenantAuditService.
    // listForExport()'s own why-note on the cap this is subject to and on
    // why the export itself shows up as its own AUDIT_LOG_EXPORTED row
    // rather than silently not being audited at all. Same from/to
    // reasoning as list() above.
    @GetMapping("/api/v1/admin/audit/export")
    public ResponseEntity<byte[]> export(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @AuthenticationPrincipal AuthenticatedPrincipal admin) {
        Instant fromInstant = from != null ? from.atStartOfDay(ZoneOffset.UTC).toInstant() : null;
        Instant toInstant = to != null ? to.plusDays(1).atStartOfDay(ZoneOffset.UTC).toInstant() : null;
        List<TenantAuditService.TenantAuditEntryView> items =
                tenantAuditService.listForExport(admin.userId(), fromInstant, toInstant);

        List<String> header = List.of("When (UTC)", "Action", "Entity type", "Entity ID", "Actor", "Before",
                "After", "IP address", "Device");
        List<List<String>> rows = items.stream().map(item -> List.of(
                CsvExport.cell(item.createdAt()),
                CsvExport.cell(item.action()),
                CsvExport.cell(item.entityType()),
                CsvExport.cell(item.entityId()),
                CsvExport.cell(item.actorName()),
                CsvExport.cell(item.beforeValue()),
                CsvExport.cell(item.afterValue()),
                CsvExport.cell(item.ipAddress()),
                CsvExport.cell(item.deviceSignature()))).toList();
        byte[] csv = CsvExport.toCsv(header, rows).getBytes(StandardCharsets.UTF_8);

        String filename = "audit-trail-" + DateTimeFormatter.ofPattern("yyyyMMdd-HHmmss")
                .withZone(ZoneOffset.UTC).format(clock.instant()) + ".csv";
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment().filename(filename).build().toString())
                .contentType(MediaType.parseMediaType("text/csv;charset=UTF-8"))
                .body(csv);
    }
}
