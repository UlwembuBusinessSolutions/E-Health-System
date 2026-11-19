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
public class ArtInitiationClinicianDetailsController {
    private final ArtInitiationClinicianDetailsService service;
    private final StaffService staffService;

    public ArtInitiationClinicianDetailsController(ArtInitiationClinicianDetailsService service,
            StaffService staffService) {
        this.service = service;
        this.staffService = staffService;
    }

    @GetMapping("/api/v1/visits/{visitId}/art-initiation-clinician-details")
    public ResponseEntity<ItemResponse> get(@PathVariable UUID visitId) {
        return ResponseEntity.ok(new ItemResponse(service.getForVisit(visitId).map(this::toResponse).orElse(null)));
    }

    @PutMapping("/api/v1/visits/{visitId}/art-initiation-clinician-details")
    public ResponseEntity<ClinicianDetailsResponse> save(@PathVariable UUID visitId,
            @Valid @RequestBody SaveRequest request,
            @AuthenticationPrincipal AuthenticatedPrincipal staff) {
        return ResponseEntity.ok(toResponse(service.save(visitId, request, staff.userId())));
    }

    private ClinicianDetailsResponse toResponse(ArtInitiationClinicianDetails details) {
        String updatedByName = staffService.resolveUserNames(Set.of(details.getUpdatedByUserId()))
                .get(details.getUpdatedByUserId());
        return new ClinicianDetailsResponse(details.getId(), details.getVisitId(), details.getSignatureDataUrl(),
                details.getClinicianName(), details.getClinicianQualifications(), details.getSancNumber(),
                details.getHpcsaNumber(), details.getUpdatedByUserId(), updatedByName,
                details.getCreatedAt(), details.getUpdatedAt());
    }

    public record SaveRequest(String signatureDataUrl, @Size(max = 200) String clinicianName,
            @Size(max = 10_000) String clinicianQualifications, @Size(max = 30) String sancNumber,
            @Size(max = 30) String hpcsaNumber) {}
    public record ItemResponse(ClinicianDetailsResponse item) {}
    public record ClinicianDetailsResponse(UUID id, UUID visitId, String signatureDataUrl,
            String clinicianName, String clinicianQualifications, String sancNumber, String hpcsaNumber,
            UUID updatedByUserId, String updatedByName, Instant createdAt, Instant updatedAt) {}
}
