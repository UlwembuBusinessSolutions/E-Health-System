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
public class ArtInitiationMedicalHistoryController {
    private final ArtInitiationMedicalHistoryService service;
    private final StaffService staffService;

    public ArtInitiationMedicalHistoryController(ArtInitiationMedicalHistoryService service,
            StaffService staffService) {
        this.service = service;
        this.staffService = staffService;
    }

    @GetMapping("/api/v1/visits/{visitId}/art-initiation-medical-history")
    public ResponseEntity<ItemResponse> get(@PathVariable UUID visitId) {
        return ResponseEntity.ok(new ItemResponse(service.getForVisit(visitId).map(this::toResponse).orElse(null)));
    }

    @PutMapping("/api/v1/visits/{visitId}/art-initiation-medical-history")
    public ResponseEntity<MedicalHistoryResponse> save(@PathVariable UUID visitId,
            @Valid @RequestBody SaveRequest request,
            @AuthenticationPrincipal AuthenticatedPrincipal staff) {
        return ResponseEntity.ok(toResponse(service.save(visitId, request.notes(), staff.userId())));
    }

    private MedicalHistoryResponse toResponse(ArtInitiationMedicalHistory history) {
        String updatedByName = staffService.resolveUserNames(Set.of(history.getUpdatedByUserId()))
                .get(history.getUpdatedByUserId());
        return new MedicalHistoryResponse(history.getId(), history.getVisitId(), history.getNotes(),
                history.getUpdatedByUserId(), updatedByName, history.getCreatedAt(), history.getUpdatedAt());
    }

    public record SaveRequest(@Size(max = 10_000) String notes) {}
    public record ItemResponse(MedicalHistoryResponse item) {}
    public record MedicalHistoryResponse(UUID id, UUID visitId, String notes, UUID updatedByUserId,
            String updatedByName, Instant createdAt, Instant updatedAt) {}
}
