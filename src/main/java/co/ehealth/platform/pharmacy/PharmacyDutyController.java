package co.ehealth.platform.pharmacy;

import co.ehealth.platform.core.security.AuthenticatedPrincipal;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.http.*;
import java.time.LocalDate;
import java.util.*;

@RestController
@RequestMapping("/api/v1/pharmacy")
public class PharmacyDutyController {
    private final PharmacyDutyService duty;
    private final PrescriberDispensingReportService report;
    public PharmacyDutyController(PharmacyDutyService duty, PrescriberDispensingReportService report) {
        this.duty=duty; this.report=report;
    }
    @GetMapping("/duty")
    public PharmacyDutyService.Status duty(@RequestParam UUID facilityId,@AuthenticationPrincipal AuthenticatedPrincipal actor) {
        return duty.status(facilityId,actor.userId());
    }
    @PostMapping("/duty")
    public Map<String,UUID> record(@Valid @RequestBody DutyRequest request,@AuthenticationPrincipal AuthenticatedPrincipal actor) {
        return Map.of("id",duty.record(request.facilityId(),actor.userId(),request.dutyType(),request.hours(),request.reason()));
    }
    @PostMapping("/duty/{id}/end")
    public void end(@PathVariable UUID id,@RequestParam UUID facilityId,@AuthenticationPrincipal AuthenticatedPrincipal actor) {
        duty.end(facilityId,id,actor.userId());
    }
    @GetMapping("/prescriber-dispensed")
    public PrescriberDispensingReportService.Report report(@RequestParam UUID facilityId,@RequestParam LocalDate from,
            @RequestParam LocalDate to,@RequestParam(defaultValue="0") int page) {
        return report.report(facilityId,from,to,page,25);
    }
    @GetMapping(value="/prescriber-dispensed.csv",produces="text/csv")
    public ResponseEntity<String> export(@RequestParam UUID facilityId,@RequestParam LocalDate from,
            @RequestParam LocalDate to,@AuthenticationPrincipal AuthenticatedPrincipal actor) {
        return ResponseEntity.ok().header(HttpHeaders.CONTENT_DISPOSITION,"attachment; filename=prescriber-dispensed.csv")
            .contentType(MediaType.parseMediaType("text/csv;charset=UTF-8")).body(report.export(facilityId,from,to,actor.userId()));
    }
    public record DutyRequest(@NotNull UUID facilityId,@NotNull @Pattern(regexp="ON_DUTY|NO_DISPENSER") String dutyType,
        @Min(1) @Max(12) int hours,@NotBlank @Size(max=500) String reason) {}
}

