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
public class ArtInitiationReferralConfirmationController {
    private final ArtInitiationReferralConfirmationService service;
    private final StaffService staffService;

    public ArtInitiationReferralConfirmationController(ArtInitiationReferralConfirmationService service,
            StaffService staffService) {
        this.service = service;
        this.staffService = staffService;
    }

    @GetMapping("/api/v1/visits/{visitId}/art-initiation-referral-confirmation")
    public ResponseEntity<ItemResponse> get(@PathVariable UUID visitId) {
        return ResponseEntity.ok(new ItemResponse(service.getForVisit(visitId).map(this::toResponse).orElse(null)));
    }

    @PutMapping("/api/v1/visits/{visitId}/art-initiation-referral-confirmation")
    public ResponseEntity<ReferralConfirmationResponse> save(@PathVariable UUID visitId,
            @Valid @RequestBody SaveRequest request,
            @AuthenticationPrincipal AuthenticatedPrincipal staff) {
        return ResponseEntity.ok(toResponse(service.save(visitId, request, staff.userId())));
    }

    private ReferralConfirmationResponse toResponse(ArtInitiationReferralConfirmation confirmation) {
        String updatedByName = staffService.resolveUserNames(Set.of(confirmation.getUpdatedByUserId()))
                .get(confirmation.getUpdatedByUserId());
        return new ReferralConfirmationResponse(confirmation.getId(), confirmation.getVisitId(),
                confirmation.getNotes(), confirmation.getUpdatedByUserId(), updatedByName,
                confirmation.getCreatedAt(), confirmation.getUpdatedAt());
    }

    public record SaveRequest(@Size(max = 10_000) String notes) {}
    public record ItemResponse(ReferralConfirmationResponse item) {}
    public record ReferralConfirmationResponse(UUID id, UUID visitId, String notes,
            UUID updatedByUserId, String updatedByName, Instant createdAt, Instant updatedAt) {}
}
