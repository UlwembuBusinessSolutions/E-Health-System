package co.ehealth.platform.platform;

import org.springframework.format.annotation.DateTimeFormat;
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

    public PlatformAuditController(PlatformAuditService platformAuditService) {
        this.platformAuditService = platformAuditService;
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
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        Instant fromInstant = from != null ? from.atStartOfDay(ZoneOffset.UTC).toInstant() : null;
        Instant toInstant = to != null ? to.plusDays(1).atStartOfDay(ZoneOffset.UTC).toInstant() : null;
        var items = platformAuditService.list(action, organizationId, fromInstant, toInstant);
        return ResponseEntity.ok(Map.of("items", items));
    }
}
