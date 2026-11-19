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
public class ArtInitiationTbScreeningController {
    private final ArtInitiationTbScreeningService service;
    private final StaffService staffService;

    public ArtInitiationTbScreeningController(ArtInitiationTbScreeningService service, StaffService staffService) {
        this.service = service;
        this.staffService = staffService;
    }

    @GetMapping("/api/v1/visits/{visitId}/art-initiation-tb-screening")
    public ResponseEntity<ItemResponse> get(@PathVariable UUID visitId) {
        return ResponseEntity.ok(new ItemResponse(service.getForVisit(visitId).map(this::toResponse).orElse(null)));
    }

    @PutMapping("/api/v1/visits/{visitId}/art-initiation-tb-screening")
    public ResponseEntity<TbScreeningResponse> save(@PathVariable UUID visitId,
            @Valid @RequestBody SaveRequest request,
            @AuthenticationPrincipal AuthenticatedPrincipal staff) {
        return ResponseEntity.ok(toResponse(service.save(visitId, request, staff.userId())));
    }

    private TbScreeningResponse toResponse(ArtInitiationTbScreening screening) {
        String updatedByName = staffService.resolveUserNames(Set.of(screening.getUpdatedByUserId()))
                .get(screening.getUpdatedByUserId());
        return new TbScreeningResponse(screening.getId(), screening.getVisitId(), screening.getPreviousTb(),
                screening.getPreviousTbYear(), screening.getPreviousTbExtraPulmonary(),
                screening.getPreviousTbPulmonary(), screening.getCurrentTb(), screening.getCurrentTbExtraPulmonary(),
                screening.getCurrentTbPulmonary(), screening.getCurrentTbTreatmentStartDate(),
                screening.getSymptomCoughOverTwoWeeks(), screening.getSymptomWeightLoss(),
                screening.getSymptomFever(), screening.getSymptomNightSweats(), screening.getSymptomHaemoptysis(),
                screening.getSymptomFatigue(), screening.getSmearDateResult(),
                screening.getCultureSensitivityDateResult(), screening.getClinicalIndication(),
                screening.getUpdatedByUserId(), updatedByName, screening.getCreatedAt(), screening.getUpdatedAt());
    }

    public record SaveRequest(Boolean previousTb, Integer previousTbYear, Boolean previousTbExtraPulmonary,
            Boolean previousTbPulmonary, Boolean currentTb, Boolean currentTbExtraPulmonary,
            Boolean currentTbPulmonary, LocalDate currentTbTreatmentStartDate,
            Boolean symptomCoughOverTwoWeeks, Boolean symptomWeightLoss, Boolean symptomFever,
            Boolean symptomNightSweats, Boolean symptomHaemoptysis, Boolean symptomFatigue,
            @Size(max = 10_000) String smearDateResult, LocalDate cultureSensitivityDateResult,
            @Size(max = 10_000) String clinicalIndication) {}

    public record ItemResponse(TbScreeningResponse item) {}

    public record TbScreeningResponse(UUID id, UUID visitId, Boolean previousTb, Integer previousTbYear,
            Boolean previousTbExtraPulmonary, Boolean previousTbPulmonary, Boolean currentTb,
            Boolean currentTbExtraPulmonary, Boolean currentTbPulmonary, LocalDate currentTbTreatmentStartDate,
            Boolean symptomCoughOverTwoWeeks, Boolean symptomWeightLoss, Boolean symptomFever,
            Boolean symptomNightSweats, Boolean symptomHaemoptysis, Boolean symptomFatigue,
            String smearDateResult, LocalDate cultureSensitivityDateResult, String clinicalIndication,
            UUID updatedByUserId, String updatedByName, Instant createdAt, Instant updatedAt) {}
}
