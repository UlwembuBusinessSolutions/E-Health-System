package co.ehealth.platform.laboratory;

import co.ehealth.platform.core.security.AuthenticatedPrincipal;
import co.ehealth.platform.identity.StaffService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
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
public class LaboratoryInvestigationController {

    private final LaboratoryInvestigationService investigationService;
    private final StaffService staffService;

    public LaboratoryInvestigationController(LaboratoryInvestigationService investigationService,
                                               StaffService staffService) {
        this.investigationService = investigationService;
        this.staffService = staffService;
    }

    @GetMapping("/api/v1/visits/{visitId}/laboratory-investigations")
    public ResponseEntity<Map<String, List<LaboratoryInvestigationResponse>>> list(@PathVariable UUID visitId) {
        List<LaboratoryInvestigation> investigations = investigationService.listForVisit(visitId);
        Map<UUID, String> names = staffService.resolveUserNames(
                investigations.stream().map(LaboratoryInvestigation::getSignedByUserId)
                        .collect(java.util.stream.Collectors.toSet()));
        List<LaboratoryInvestigationResponse> items = investigations.stream()
                .map(item -> LaboratoryInvestigationResponse.from(item, names.get(item.getSignedByUserId())))
                .toList();
        return ResponseEntity.ok(Map.of("items", items));
    }

    @PostMapping("/api/v1/visits/{visitId}/laboratory-investigations")
    public ResponseEntity<Map<String, List<LaboratoryInvestigationResponse>>> save(
            @PathVariable UUID visitId, @Valid @RequestBody SaveLaboratoryInvestigationsRequest request,
            @AuthenticationPrincipal AuthenticatedPrincipal staff) {
        List<LaboratoryInvestigation> investigations = investigationService.save(visitId,
                request.items().stream().map(item -> new LaboratoryInvestigationService
                        .CreateLaboratoryInvestigationCommand(item.investigationDate(), item.testName(),
                        item.testResults())).toList(), staff.userId());
        Set<UUID> userIds = investigations.stream().map(LaboratoryInvestigation::getSignedByUserId)
                .collect(java.util.stream.Collectors.toSet());
        Map<UUID, String> names = staffService.resolveUserNames(userIds);
        List<LaboratoryInvestigationResponse> items = investigations.stream()
                .map(item -> LaboratoryInvestigationResponse.from(item, names.get(item.getSignedByUserId())))
                .toList();
        return ResponseEntity.status(HttpStatus.CREATED).body(Map.of("items", items));
    }

    public record SaveLaboratoryInvestigationsRequest(
            @NotEmpty @Size(max = 50) List<@Valid LaboratoryInvestigationRequest> items) {
    }

    public record LaboratoryInvestigationRequest(@NotNull LocalDate investigationDate,
                                                   @NotBlank @Size(max = 200) String testName,
                                                   @NotBlank @Size(max = 10_000) String testResults) {
    }

    public record LaboratoryInvestigationResponse(UUID id, UUID visitId, LocalDate investigationDate,
            String testName, String testResults, UUID signedByUserId, String signedByName,
            Instant signedAt, Instant createdAt) {
        static LaboratoryInvestigationResponse from(LaboratoryInvestigation investigation, String signedByName) {
            return new LaboratoryInvestigationResponse(investigation.getId(), investigation.getVisitId(),
                    investigation.getInvestigationDate(), investigation.getTestName(),
                    investigation.getTestResults(), investigation.getSignedByUserId(), signedByName,
                    investigation.getSignedAt(), investigation.getCreatedAt());
        }
    }
}
