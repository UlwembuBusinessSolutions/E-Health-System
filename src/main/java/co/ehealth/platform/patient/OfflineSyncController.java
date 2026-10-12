package co.ehealth.platform.patient;

import co.ehealth.platform.core.security.AuthenticatedPrincipal;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.NotBlank;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

// Sync + issue listing: any authenticated staff member with the right PREG
// permission (enforced in OfflineSyncService), like the rest of patient
// registration. Resolve lives under /api/v1/admin/** so SecurityConfig's
// existing ORG_ADMIN rule covers it.
@RestController
public class OfflineSyncController {

    private final OfflineSyncService syncService;
    private final PatientRepository patientRepository;

    public OfflineSyncController(OfflineSyncService syncService, PatientRepository patientRepository) {
        this.syncService = syncService;
        this.patientRepository = patientRepository;
    }

    // Deliberately no @Valid on the body: a bad record must become a
    // per-record REJECTED, not a 400 that blocks the rest of the batch.
    // Always 200 when the request itself is acceptable; outcomes are per record.
    @PostMapping("/api/v1/patients/sync")
    public ResponseEntity<Map<String, Object>> sync(@RequestBody SyncBatchRequest request,
            @AuthenticationPrincipal AuthenticatedPrincipal staff) {
        List<OfflineSyncService.SyncItem> items = request.records() == null ? List.of()
                : request.records().stream()
                        .map(r -> r == null ? null
                                : new OfflineSyncService.SyncItem(r.clientRecordId(), r.capturedAt(), r.data()))
                        .toList();
        return ResponseEntity.ok(Map.of("results", syncService.sync(request.deviceId(), items, staff.userId())));
    }

    @GetMapping("/api/v1/patients/sync/issues")
    public ResponseEntity<Map<String, Object>> issues() {
        List<IssueResponse> items = syncService.listOpenIssues().stream().map(r -> {
            PatientController.PatientSummary existing = r.getConflictingPatientId() == null ? null
                    : patientRepository.findById(r.getConflictingPatientId())
                            .map(p -> PatientController.PatientSummary.from(p, false)).orElse(null);
            return new IssueResponse(r.getId(), r.getClientRecordId(), r.getStatus(), r.getConflictType(),
                    r.getMessage(), syncService.readPayload(r), existing, r.getCapturedAt(), r.getReceivedAt());
        }).toList();
        return ResponseEntity.ok(Map.of("items", items));
    }

    @PostMapping("/api/v1/admin/patients/sync/issues/{id}/resolve")
    public ResponseEntity<Void> resolve(@PathVariable UUID id, @Valid @RequestBody ResolveRequest request,
            @AuthenticationPrincipal AuthenticatedPrincipal staff) {
        syncService.resolve(id, request.resolution(), request.reason(), staff.userId());
        return ResponseEntity.noContent().build();
    }

    public record SyncBatchRequest(String deviceId, List<SyncRecordRequest> records) {
    }

    public record SyncRecordRequest(UUID clientRecordId, Instant capturedAt,
            PatientController.RegisterPatientRequest data) {
    }

    public record ResolveRequest(@NotNull SyncResolution resolution, @NotBlank String reason) {
    }

    public record IssueResponse(UUID id, UUID clientRecordId, OfflineSyncStatus status,
            OfflineConflictType conflictType, String message,
            PatientController.RegisterPatientRequest offlineData,
            PatientController.PatientSummary existingPatient,
            Instant capturedAt, Instant receivedAt) {
    }
}