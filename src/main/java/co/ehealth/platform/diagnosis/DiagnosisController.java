package co.ehealth.platform.diagnosis;

import co.ehealth.platform.core.tenant.ModuleCode;
import co.ehealth.platform.identity.PermissionLevel;
import co.ehealth.platform.identity.PermissionService;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.Clock;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import java.util.UUID;

// What the consultation's diagnosis box reads while the doctor types, and a first look at the numbers
// the catalogue makes possible. Adding a diagnosis that is not there happens when it is recorded on a
// consultation, not here.
@RestController
@RequestMapping("/api/v1/diagnoses")
public class DiagnosisController {

    private static final int DEFAULT_DAYS = 30;

    private final DiagnosisCatalogueService catalogue;
    private final PermissionService permissionService;
    private final Clock clock;

    public DiagnosisController(DiagnosisCatalogueService catalogue, PermissionService permissionService, Clock clock) {
        this.catalogue = catalogue;
        this.permissionService = permissionService;
        this.clock = clock;
    }

    public record DiagnosisResponse(UUID id, String code, String name, String source) {
        static DiagnosisResponse from(Diagnosis diagnosis) {
            return new DiagnosisResponse(diagnosis.getId(), diagnosis.getCode(), diagnosis.getName(),
                    diagnosis.getSource());
        }
    }

    public record CountResponse(UUID diagnosisId, String code, String name, String source, long total) {
    }

    // Needs at least two characters; shorter searches return an empty list.
    @GetMapping
    public ResponseEntity<Map<String, Object>> search(@RequestParam(required = false, defaultValue = "") String q) {
        permissionService.requireAccess(ModuleCode.RECQ, PermissionLevel.VIEW);
        List<DiagnosisResponse> items = catalogue.search(q).stream().map(DiagnosisResponse::from).toList();
        return ResponseEntity.ok(Map.of("items", items));
    }

    // How often each diagnosis was recorded on consultations signed in the period (default: the last 30 days).
    @GetMapping("/summary")
    public ResponseEntity<Map<String, Object>> summary(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        permissionService.requireAccess(ModuleCode.RECQ, PermissionLevel.VIEW);
        LocalDate last = to != null ? to : LocalDate.now(clock);
        LocalDate first = from != null ? from : last.minusDays(DEFAULT_DAYS);
        List<CountResponse> items = catalogue.counts(first.atStartOfDay().toInstant(ZoneOffset.UTC),
                last.plusDays(1).atStartOfDay().toInstant(ZoneOffset.UTC)).stream()
                .map(count -> new CountResponse(count.getDiagnosisId(), count.getCode(), count.getName(),
                        count.getSource(), count.getTotal())).toList();
        return ResponseEntity.ok(Map.of("from", first.toString(), "to", last.toString(), "items", items));
    }
}
