package co.ehealth.platform.visit;

import co.ehealth.platform.core.security.AuthenticatedPrincipal;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@RestController
public class TriageController {
    private final TriageService triageService;

    public TriageController(TriageService triageService) {
        this.triageService = triageService;
    }

    @PostMapping("/api/v1/visits/{visitId}/triage")
    public ResponseEntity<TriageResponse> record(@PathVariable UUID visitId,
                                                  @Valid @RequestBody TriageRequest request,
                                                  @AuthenticationPrincipal AuthenticatedPrincipal staff) {
        TriageVitals vitals = new TriageVitals(request.respiratoryRate(), request.pulseRate(), request.systolicBp(),
                request.temperature(), request.avpu(), request.mobility(), request.trauma(), request.deceased());
        return ResponseEntity.ok(TriageResponse.from(
                triageService.record(visitId, vitals, request.overrideColour(), request.overrideReason(), staff.userId())));
    }

    public record TriageRequest(@Min(0) int respiratoryRate, @Min(0) int pulseRate, @Min(0) int systolicBp,
                                @NotNull BigDecimal temperature, @NotNull Avpu avpu, @NotNull Mobility mobility,
                                boolean trauma, boolean deceased, TriageColour overrideColour, String overrideReason) {}

    public record TriageResponse(UUID id, int tewsScore, TriageColour calculatedColour, TriageColour assignedColour,
                                 Integer slaMinutes, String sla, String overrideReason, Instant recordedAt) {
        static TriageResponse from(TriageAssessment a) {
            return new TriageResponse(a.getId(), a.getTewsScore(), a.getCalculatedColour(), a.getAssignedColour(),
                    a.getSlaMinutes(), a.getAssignedColour().getSla(), a.getOverrideReason(), a.getRecordedAt());
        }
    }
}
