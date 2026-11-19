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
public class ArtReproductiveHealthDetailsController {

    private final ArtReproductiveHealthDetailsService detailsService;
    private final StaffService staffService;

    public ArtReproductiveHealthDetailsController(ArtReproductiveHealthDetailsService detailsService,
            StaffService staffService) {
        this.detailsService = detailsService;
        this.staffService = staffService;
    }

    @GetMapping("/api/v1/visits/{visitId}/art-reproductive-health-details")
    public ResponseEntity<ArtReproductiveHealthDetailsItemResponse> get(@PathVariable UUID visitId) {
        ArtReproductiveHealthDetailsResponse item = detailsService.getForVisit(visitId)
                .map(this::toResponse)
                .orElse(null);
        return ResponseEntity.ok(new ArtReproductiveHealthDetailsItemResponse(item));
    }

    @PutMapping("/api/v1/visits/{visitId}/art-reproductive-health-details")
    public ResponseEntity<ArtReproductiveHealthDetailsResponse> save(@PathVariable UUID visitId,
            @Valid @RequestBody SaveArtReproductiveHealthDetailsRequest request,
            @AuthenticationPrincipal AuthenticatedPrincipal staff) {
        ArtReproductiveHealthDetails details = detailsService.save(
                visitId,
                new ArtReproductiveHealthDetailsService.SaveArtReproductiveHealthDetailsCommand(
                        request.pregnant(),
                        request.trimester(),
                        request.gravida(),
                        request.para(),
                        request.contraceptionMethod(),
                        request.contraceptionOtherSpecify(),
                        request.urethralDischarge(),
                        request.urethralDischargeComment(),
                        request.vaginalDischarge(),
                        request.vaginalDischargeComment(),
                        request.genitalUlcers(),
                        request.genitalUlcersComment(),
                        request.genitalWarts(),
                        request.genitalWartsComment(),
                        request.lowerAbdominalPain(),
                        request.lowerAbdominalPainComment(),
                        request.papSmearResult(),
                        request.papSmearDate(),
                        request.rprDate(),
                        request.results(),
                        request.specifyTreatmentCompleted()),
                staff.userId());
        return ResponseEntity.ok(toResponse(details));
    }

    private ArtReproductiveHealthDetailsResponse toResponse(ArtReproductiveHealthDetails details) {
        String recordedByName = staffService.resolveUserNames(Set.of(details.getUpdatedByUserId()))
                .get(details.getUpdatedByUserId());
        return new ArtReproductiveHealthDetailsResponse(
                details.getId(),
                details.getVisitId(),
                details.getPregnant(),
                details.getTrimester(),
                details.getGravida(),
                details.getPara(),
                details.getContraceptionMethod(),
                details.getContraceptionOtherSpecify(),
                details.getUrethralDischarge(),
                details.getUrethralDischargeComment(),
                details.getVaginalDischarge(),
                details.getVaginalDischargeComment(),
                details.getGenitalUlcers(),
                details.getGenitalUlcersComment(),
                details.getGenitalWarts(),
                details.getGenitalWartsComment(),
                details.getLowerAbdominalPain(),
                details.getLowerAbdominalPainComment(),
                details.getPapSmearResult(),
                details.getPapSmearDate(),
                details.getRprDate(),
                details.getResults(),
                details.getSpecifyTreatmentCompleted(),
                details.getUpdatedByUserId(),
                recordedByName,
                details.getCreatedAt(),
                details.getUpdatedAt());
    }

    public record SaveArtReproductiveHealthDetailsRequest(Boolean pregnant, Integer trimester, String gravida,
            String para, ContraceptionMethod contraceptionMethod, @Size(max = 10_000) String contraceptionOtherSpecify,
            Boolean urethralDischarge, @Size(max = 10_000) String urethralDischargeComment,
            Boolean vaginalDischarge, @Size(max = 10_000) String vaginalDischargeComment,
            Boolean genitalUlcers, @Size(max = 10_000) String genitalUlcersComment,
            Boolean genitalWarts, @Size(max = 10_000) String genitalWartsComment,
            Boolean lowerAbdominalPain, @Size(max = 10_000) String lowerAbdominalPainComment,
            @Size(max = 10_000) String papSmearResult, LocalDate papSmearDate, LocalDate rprDate,
            @Size(max = 10_000) String results,
            @Size(max = 10_000) String specifyTreatmentCompleted) {
    }

    public record ArtReproductiveHealthDetailsItemResponse(ArtReproductiveHealthDetailsResponse item) {
    }

    public record ArtReproductiveHealthDetailsResponse(UUID id, UUID visitId, Boolean pregnant, Integer trimester,
            String gravida, String para, ContraceptionMethod contraceptionMethod, String contraceptionOtherSpecify,
            Boolean urethralDischarge, String urethralDischargeComment,
            Boolean vaginalDischarge, String vaginalDischargeComment,
            Boolean genitalUlcers, String genitalUlcersComment,
            Boolean genitalWarts, String genitalWartsComment,
            Boolean lowerAbdominalPain, String lowerAbdominalPainComment,
            String papSmearResult, LocalDate papSmearDate, LocalDate rprDate,
            String results, String specifyTreatmentCompleted,
            UUID updatedByUserId, String updatedByName, Instant createdAt, Instant updatedAt) {
    }
}
