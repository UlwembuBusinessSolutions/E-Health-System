package co.ehealth.platform.art;

import co.ehealth.platform.core.security.AuthenticatedPrincipal;
import co.ehealth.platform.identity.StaffService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.Min;
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
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@RestController
public class ArtInitiationLongitudinalRecordController {
    private final ArtInitiationLongitudinalRecordService recordService;
    private final StaffService staffService;

    public ArtInitiationLongitudinalRecordController(ArtInitiationLongitudinalRecordService recordService,
            StaffService staffService) {
        this.recordService = recordService;
        this.staffService = staffService;
    }

    @GetMapping("/api/v1/visits/{visitId}/art-initiation-longitudinal-records")
    public ResponseEntity<Map<String, List<RecordResponse>>> list(@PathVariable UUID visitId) {
        List<ArtInitiationLongitudinalRecord> records = recordService.listForVisit(visitId);
        Map<UUID, String> names = staffService.resolveUserNames(
                records.stream().map(ArtInitiationLongitudinalRecord::getSignedByUserId)
                        .collect(java.util.stream.Collectors.toSet()));
        List<RecordResponse> items = records.stream()
                .map(record -> RecordResponse.from(record, names.get(record.getSignedByUserId())))
                .toList();
        return ResponseEntity.ok(Map.of("items", items));
    }

    @PostMapping("/api/v1/visits/{visitId}/art-initiation-longitudinal-records")
    public ResponseEntity<RecordResponse> save(@PathVariable UUID visitId,
            @Valid @RequestBody SaveRequest request,
            @AuthenticationPrincipal AuthenticatedPrincipal staff) {
        ArtInitiationLongitudinalRecord record = recordService.save(visitId,
                new ArtInitiationLongitudinalRecordService.CreateCommand(request.recordDate(),
                        request.durationOnArtMonths(), request.stage(), request.patientWeightKg(),
                        request.viralLoad(), request.cd4Count(), request.stageDescription()),
                staff.userId());
        String signedByName = staffService.resolveUserNames(Set.of(record.getSignedByUserId()))
                .get(record.getSignedByUserId());
        return ResponseEntity.status(HttpStatus.CREATED).body(RecordResponse.from(record, signedByName));
    }

    public record SaveRequest(@NotNull LocalDate recordDate, @Min(0) Integer durationOnArtMonths,
            @NotNull ArtStage stage,
            @DecimalMin("0.01") @Digits(integer = 4, fraction = 2) BigDecimal patientWeightKg,
            @Size(max = 200) String viralLoad, @Size(max = 200) String cd4Count,
            @Size(max = 10_000) String stageDescription) {}

    public record RecordResponse(UUID id, UUID visitId, LocalDate recordDate, Integer durationOnArtMonths,
            ArtStage stage, BigDecimal patientWeightKg, String viralLoad, String cd4Count,
            String stageDescription, UUID signedByUserId, String signedByName, Instant signedAt) {
        static RecordResponse from(ArtInitiationLongitudinalRecord record, String signedByName) {
            return new RecordResponse(record.getId(), record.getVisitId(), record.getRecordDate(),
                    record.getDurationOnArtMonths(), record.getStage(), record.getPatientWeightKg(),
                    record.getViralLoad(), record.getCd4Count(), record.getStageDescription(),
                    record.getSignedByUserId(), signedByName, record.getSignedAt());
        }
    }
}
