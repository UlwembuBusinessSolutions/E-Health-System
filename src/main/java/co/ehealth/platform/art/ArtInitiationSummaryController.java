package co.ehealth.platform.art;

import co.ehealth.platform.core.security.AuthenticatedPrincipal;
import co.ehealth.platform.identity.StaffService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Size;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.time.LocalDate;
import java.util.Set;
import java.util.UUID;

@RestController
public class ArtInitiationSummaryController {

    private final ArtInitiationSummaryService summaryService;
    private final StaffService staffService;

    public ArtInitiationSummaryController(ArtInitiationSummaryService summaryService, StaffService staffService) {
        this.summaryService = summaryService;
        this.staffService = staffService;
    }

    @GetMapping("/api/v1/visits/{visitId}/art-initiation-summary-details")
    public ResponseEntity<ArtInitiationSummaryItemResponse> get(@PathVariable UUID visitId) {
        ArtInitiationSummaryResponse item = summaryService.getForVisit(visitId)
                .map(this::toResponse)
                .orElse(null);
        return ResponseEntity.ok(new ArtInitiationSummaryItemResponse(item));
    }

    @PutMapping("/api/v1/visits/{visitId}/art-initiation-summary-details")
    public ResponseEntity<ArtInitiationSummaryResponse> save(@PathVariable UUID visitId,
            @Valid @RequestBody SaveArtInitiationSummaryRequest request,
            @AuthenticationPrincipal AuthenticatedPrincipal staff) {
        ArtInitiationSummary summary = summaryService.save(visitId,
                new ArtInitiationSummaryService.SaveArtInitiationSummaryCommand(request.artStartDate(),
                        request.hivDiagnosisYear(), request.priorTherapy(), request.details()),
                staff.userId());
        return ResponseEntity.ok(toResponse(summary));
    }

    private ArtInitiationSummaryResponse toResponse(ArtInitiationSummary summary) {
        String updatedByName = staffService.resolveUserNames(Set.of(summary.getUpdatedByUserId()))
                .get(summary.getUpdatedByUserId());
        return new ArtInitiationSummaryResponse(summary.getId(), summary.getVisitId(), summary.getArtStartDate(),
                summary.getHivDiagnosisYear(), summary.getPriorTherapy(), summary.getDetails(),
                summary.getUpdatedByUserId(), updatedByName, summary.getCreatedAt(), summary.getUpdatedAt());
    }

    public record SaveArtInitiationSummaryRequest(LocalDate artStartDate, Integer hivDiagnosisYear,
            ArtPriorTherapy priorTherapy, @Size(max = 10_000) String details) {
    }

    public record ArtInitiationSummaryItemResponse(ArtInitiationSummaryResponse item) {
    }

    public record ArtInitiationSummaryResponse(UUID id, UUID visitId, LocalDate artStartDate,
            Integer hivDiagnosisYear, ArtPriorTherapy priorTherapy, String details,
            UUID updatedByUserId, String updatedByName, Instant createdAt, Instant updatedAt) {
    }
}
