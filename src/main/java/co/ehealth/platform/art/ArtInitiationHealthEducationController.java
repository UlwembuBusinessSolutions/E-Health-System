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
import java.util.Set;
import java.util.UUID;

@RestController
public class ArtInitiationHealthEducationController {
    private final ArtInitiationHealthEducationService service;
    private final StaffService staffService;

    public ArtInitiationHealthEducationController(ArtInitiationHealthEducationService service,
            StaffService staffService) {
        this.service = service;
        this.staffService = staffService;
    }

    @GetMapping("/api/v1/visits/{visitId}/art-initiation-health-education")
    public ResponseEntity<ItemResponse> get(@PathVariable UUID visitId) {
        return ResponseEntity.ok(new ItemResponse(service.getForVisit(visitId).map(this::toResponse).orElse(null)));
    }

    @PutMapping("/api/v1/visits/{visitId}/art-initiation-health-education")
    public ResponseEntity<HealthEducationResponse> save(@PathVariable UUID visitId,
            @Valid @RequestBody SaveRequest request,
            @AuthenticationPrincipal AuthenticatedPrincipal staff) {
        return ResponseEntity.ok(toResponse(service.save(visitId, request, staff.userId())));
    }

    private HealthEducationResponse toResponse(ArtInitiationHealthEducation details) {
        String updatedByName = staffService.resolveUserNames(Set.of(details.getUpdatedByUserId()))
                .get(details.getUpdatedByUserId());
        return new HealthEducationResponse(details.getId(), details.getVisitId(), details.getCondomImportance(),
                details.getHealthyLifestyleDiet(), details.getPartnerTesting(), details.getHivStatusDisclosure(),
                details.getAdherenceCompliance(), details.getFamilyPlanning(), details.getGeneralHivInformation(),
                details.getRegularPapSmear(), details.getMedicationSideEffects(),
                details.getClinicAttendanceForHealthIssues(), details.getHerbalTraditionalMedicationDiscussion(),
                details.getOtherDiscussed(), details.getOtherSpecify(), details.getUpdatedByUserId(), updatedByName,
                details.getCreatedAt(), details.getUpdatedAt());
    }

    public record SaveRequest(Boolean condomImportance, Boolean healthyLifestyleDiet, Boolean partnerTesting,
            Boolean hivStatusDisclosure, Boolean adherenceCompliance, Boolean familyPlanning,
            Boolean generalHivInformation, Boolean regularPapSmear, Boolean medicationSideEffects,
            Boolean clinicAttendanceForHealthIssues, Boolean herbalTraditionalMedicationDiscussion,
            Boolean otherDiscussed, @Size(max = 10_000) String otherSpecify) {}

    public record ItemResponse(HealthEducationResponse item) {}
    public record HealthEducationResponse(UUID id, UUID visitId, Boolean condomImportance,
            Boolean healthyLifestyleDiet, Boolean partnerTesting, Boolean hivStatusDisclosure,
            Boolean adherenceCompliance, Boolean familyPlanning, Boolean generalHivInformation,
            Boolean regularPapSmear, Boolean medicationSideEffects, Boolean clinicAttendanceForHealthIssues,
            Boolean herbalTraditionalMedicationDiscussion, Boolean otherDiscussed, String otherSpecify,
            UUID updatedByUserId, String updatedByName, Instant createdAt, Instant updatedAt) {}
}
