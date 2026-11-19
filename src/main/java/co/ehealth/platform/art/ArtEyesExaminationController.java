package co.ehealth.platform.art;

import co.ehealth.platform.core.security.AuthenticatedPrincipal;
import co.ehealth.platform.identity.StaffService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
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
public class ArtEyesExaminationController {

    private final ArtEyesExaminationService examinationService;
    private final StaffService staffService;

    public ArtEyesExaminationController(ArtEyesExaminationService examinationService, StaffService staffService) {
        this.examinationService = examinationService;
        this.staffService = staffService;
    }

    @GetMapping("/api/v1/visits/{visitId}/art-eyes-examination")
    public ResponseEntity<ArtEyesExaminationItemResponse> get(@PathVariable UUID visitId) {
        ArtEyesExaminationResponse item = examinationService.getForVisit(visitId)
                .map(this::toResponse)
                .orElse(null);
        return ResponseEntity.ok(new ArtEyesExaminationItemResponse(item));
    }

    @PutMapping("/api/v1/visits/{visitId}/art-eyes-examination")
    public ResponseEntity<ArtEyesExaminationResponse> save(@PathVariable UUID visitId,
            @Valid @RequestBody SaveArtEyesExaminationRequest request,
            @AuthenticationPrincipal AuthenticatedPrincipal staff) {
        ArtEyesExamination examination = examinationService.save(
                visitId, request.result(), request.comments(), staff.userId());
        return ResponseEntity.ok(toResponse(examination));
    }

    private ArtEyesExaminationResponse toResponse(ArtEyesExamination examination) {
        String recordedByName = staffService.resolveUserNames(Set.of(examination.getRecordedByUserId()))
                .get(examination.getRecordedByUserId());
        return new ArtEyesExaminationResponse(examination.getId(), examination.getVisitId(),
                examination.getResult(), examination.getComments(), examination.getRecordedByUserId(), recordedByName,
                examination.getCreatedAt(), examination.getUpdatedAt());
    }

    public record SaveArtEyesExaminationRequest(@NotNull EyeExaminationResult result,
            @Size(max = 10_000) String comments) {
    }

    public record ArtEyesExaminationItemResponse(ArtEyesExaminationResponse item) {
    }

    public record ArtEyesExaminationResponse(UUID id, UUID visitId, EyeExaminationResult result, String comments,
            UUID recordedByUserId, String recordedByName, Instant createdAt, Instant updatedAt) {
    }
}
