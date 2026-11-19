package co.ehealth.platform.art;

import co.ehealth.platform.core.security.AuthenticatedPrincipal;
import co.ehealth.platform.identity.StaffService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@RestController
public class ArtLongitudinalRecordController {

    private final ArtLongitudinalRecordService recordService;
    private final StaffService staffService;

    public ArtLongitudinalRecordController(ArtLongitudinalRecordService recordService, StaffService staffService) {
        this.recordService = recordService;
        this.staffService = staffService;
    }

    @GetMapping("/api/v1/visits/{visitId}/art-longitudinal-records")
    public ResponseEntity<Map<String, List<ArtLongitudinalRecordResponse>>> list(@PathVariable UUID visitId) {
        List<ArtLongitudinalRecord> records = recordService.listForVisit(visitId);
        Map<UUID, String> names = staffService.resolveUserNames(
                records.stream().map(ArtLongitudinalRecord::getSignedByUserId)
                        .collect(java.util.stream.Collectors.toSet()));
        List<ArtLongitudinalRecordResponse> items = records.stream()
                .map(record -> ArtLongitudinalRecordResponse.from(record, names.get(record.getSignedByUserId())))
                .toList();
        return ResponseEntity.ok(Map.of("items", items));
    }

    @PostMapping("/api/v1/visits/{visitId}/art-longitudinal-records")
    public ResponseEntity<ArtLongitudinalRecordResponse> save(@PathVariable UUID visitId,
            @Valid @RequestBody SaveArtLongitudinalRecordRequest request,
            @AuthenticationPrincipal AuthenticatedPrincipal staff) {
        ArtLongitudinalRecord record = recordService.save(visitId,
                new ArtLongitudinalRecordService.CreateArtLongitudinalRecordCommand(request.recordDate(),
                        request.durationOnArt(), request.stage(), request.viralLoad(), request.cd4Count(),
                        request.stageDescription()), staff.userId());
        Set<UUID> userIds = Set.of(record.getSignedByUserId());
        String signedByName = staffService.resolveUserNames(userIds).get(record.getSignedByUserId());
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ArtLongitudinalRecordResponse.from(record, signedByName));
    }

    public record SaveArtLongitudinalRecordRequest(@NotNull LocalDate recordDate,
            @Size(max = 200) String durationOnArt, @NotNull ArtStage stage,
            @Size(max = 200) String viralLoad, @Size(max = 200) String cd4Count,
            @Size(max = 10_000) String stageDescription) {
    }

    public record ArtLongitudinalRecordResponse(UUID id, UUID visitId, LocalDate recordDate,
            String durationOnArt, ArtStage stage, String viralLoad, String cd4Count, String stageDescription,
            UUID signedByUserId, String signedByName, Instant signedAt, Instant createdAt) {
        static ArtLongitudinalRecordResponse from(ArtLongitudinalRecord record, String signedByName) {
            return new ArtLongitudinalRecordResponse(record.getId(), record.getVisitId(), record.getRecordDate(),
                    record.getDurationOnArt(), record.getStage(), record.getViralLoad(), record.getCd4Count(),
                    record.getStageDescription(), record.getSignedByUserId(), signedByName,
                    record.getSignedAt(), record.getCreatedAt());
        }
    }
}
