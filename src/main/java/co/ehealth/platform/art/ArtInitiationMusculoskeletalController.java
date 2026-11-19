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
public class ArtInitiationMusculoskeletalController {
    private final ArtInitiationMusculoskeletalService service;
    private final StaffService staffService;

    public ArtInitiationMusculoskeletalController(ArtInitiationMusculoskeletalService service,
            StaffService staffService) {
        this.service = service;
        this.staffService = staffService;
    }

    @GetMapping("/api/v1/visits/{visitId}/art-initiation-musculoskeletal")
    public ResponseEntity<ItemResponse> get(@PathVariable UUID visitId) {
        return ResponseEntity.ok(new ItemResponse(service.getForVisit(visitId).map(this::toResponse).orElse(null)));
    }

    @PutMapping("/api/v1/visits/{visitId}/art-initiation-musculoskeletal")
    public ResponseEntity<MusculoskeletalResponse> save(@PathVariable UUID visitId,
            @Valid @RequestBody SaveRequest request,
            @AuthenticationPrincipal AuthenticatedPrincipal staff) {
        return ResponseEntity.ok(toResponse(service.save(visitId, request, staff.userId())));
    }

    private MusculoskeletalResponse toResponse(ArtInitiationMusculoskeletal details) {
        String updatedByName = staffService.resolveUserNames(Set.of(details.getUpdatedByUserId()))
                .get(details.getUpdatedByUserId());
        return new MusculoskeletalResponse(details.getId(), details.getVisitId(), details.getFinding(),
                details.getComment(), details.getUpdatedByUserId(), updatedByName,
                details.getCreatedAt(), details.getUpdatedAt());
    }

    public record SaveRequest(String finding, @Size(max = 10_000) String comment) {}
    public record ItemResponse(MusculoskeletalResponse item) {}
    public record MusculoskeletalResponse(UUID id, UUID visitId, String finding, String comment,
            UUID updatedByUserId, String updatedByName, Instant createdAt, Instant updatedAt) {}
}
