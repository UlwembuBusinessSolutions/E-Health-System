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
public class ArtInitiationJaccolExaminationController {
    private final ArtInitiationJaccolExaminationService service;
    private final StaffService staffService;

    public ArtInitiationJaccolExaminationController(ArtInitiationJaccolExaminationService service,
            StaffService staffService) {
        this.service = service;
        this.staffService = staffService;
    }

    @GetMapping("/api/v1/visits/{visitId}/art-initiation-jaccol-examination")
    public ResponseEntity<ItemResponse> get(@PathVariable UUID visitId) {
        return ResponseEntity.ok(new ItemResponse(service.getForVisit(visitId).map(this::toResponse).orElse(null)));
    }

    @PutMapping("/api/v1/visits/{visitId}/art-initiation-jaccol-examination")
    public ResponseEntity<JaccolResponse> save(@PathVariable UUID visitId,
            @Valid @RequestBody SaveRequest request,
            @AuthenticationPrincipal AuthenticatedPrincipal staff) {
        return ResponseEntity.ok(toResponse(service.save(visitId, request, staff.userId())));
    }

    private JaccolResponse toResponse(ArtInitiationJaccolExamination examination) {
        String updatedByName = staffService.resolveUserNames(Set.of(examination.getUpdatedByUserId()))
                .get(examination.getUpdatedByUserId());
        return new JaccolResponse(examination.getId(), examination.getVisitId(), examination.getJStatus(),
                examination.getJComment(), examination.getAStatus(), examination.getAComment(),
                examination.getC1Status(), examination.getC1Comment(), examination.getC2Status(),
                examination.getC2Comment(), examination.getOStatus(), examination.getOComment(),
                examination.getLStatus(), examination.getLComment(), examination.getOtherComment(),
                examination.getNotes(), examination.getUpdatedByUserId(), updatedByName,
                examination.getCreatedAt(), examination.getUpdatedAt());
    }

    public record SaveRequest(String jStatus, @Size(max = 10_000) String jComment,
            String aStatus, @Size(max = 10_000) String aComment,
            String c1Status, @Size(max = 10_000) String c1Comment,
            String c2Status, @Size(max = 10_000) String c2Comment,
            String oStatus, @Size(max = 10_000) String oComment,
            String lStatus, @Size(max = 10_000) String lComment,
            @Size(max = 10_000) String otherComment, @Size(max = 10_000) String notes) {}

    public record ItemResponse(JaccolResponse item) {}

    public record JaccolResponse(UUID id, UUID visitId, String jStatus, String jComment,
            String aStatus, String aComment, String c1Status, String c1Comment,
            String c2Status, String c2Comment, String oStatus, String oComment,
            String lStatus, String lComment, String otherComment, String notes,
            UUID updatedByUserId, String updatedByName, Instant createdAt, Instant updatedAt) {}
}
