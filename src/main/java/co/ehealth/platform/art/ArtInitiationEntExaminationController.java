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
public class ArtInitiationEntExaminationController {
    private final ArtInitiationEntExaminationService service;
    private final StaffService staffService;

    public ArtInitiationEntExaminationController(ArtInitiationEntExaminationService service,
            StaffService staffService) {
        this.service = service;
        this.staffService = staffService;
    }

    @GetMapping("/api/v1/visits/{visitId}/art-initiation-ent-examination")
    public ResponseEntity<ItemResponse> get(@PathVariable UUID visitId) {
        return ResponseEntity.ok(new ItemResponse(service.getForVisit(visitId).map(this::toResponse).orElse(null)));
    }

    @PutMapping("/api/v1/visits/{visitId}/art-initiation-ent-examination")
    public ResponseEntity<EntExaminationResponse> save(@PathVariable UUID visitId,
            @Valid @RequestBody SaveRequest request,
            @AuthenticationPrincipal AuthenticatedPrincipal staff) {
        return ResponseEntity.ok(toResponse(service.save(visitId, request, staff.userId())));
    }

    private EntExaminationResponse toResponse(ArtInitiationEntExamination examination) {
        String updatedByName = staffService.resolveUserNames(Set.of(examination.getUpdatedByUserId()))
                .get(examination.getUpdatedByUserId());
        return new EntExaminationResponse(examination.getId(), examination.getVisitId(), examination.getFinding(),
                examination.getNormalComment(), examination.getAbnormalComment(), examination.getUpdatedByUserId(),
                updatedByName, examination.getCreatedAt(), examination.getUpdatedAt());
    }

    public record SaveRequest(String finding, @Size(max = 10_000) String normalComment,
            @Size(max = 10_000) String abnormalComment) {}
    public record ItemResponse(EntExaminationResponse item) {}
    public record EntExaminationResponse(UUID id, UUID visitId, String finding, String normalComment,
            String abnormalComment, UUID updatedByUserId, String updatedByName,
            Instant createdAt, Instant updatedAt) {}
}
