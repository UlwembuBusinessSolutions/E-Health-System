package co.ehealth.platform.visit;

import co.ehealth.platform.core.security.AuthenticatedPrincipal;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;
import java.util.UUID;

// Same gating as VisitController/PatientController — any authenticated
// staff member, not ORG_ADMIN-only. facilityId is always an explicit query
// param rather than inferred from the caller's own User.facilityId: an
// ORG_ADMIN (or any staff assigned to more than one facility) has no
// single "current" facility to default to, same reasoning
// AddStaffScreen's facility dropdown is explicit rather than assumed.
@RestController
public class QueueController {

    private final QueueService queueService;

    public QueueController(QueueService queueService) {
        this.queueService = queueService;
    }

    @GetMapping("/api/v1/queue")
    public ResponseEntity<Map<String, Object>> list(@RequestParam UUID facilityId) {
        List<QueueEntryResponse> items =
                queueService.listActiveQueueView(facilityId).stream().map(QueueEntryResponse::from).toList();
        return ResponseEntity.ok(Map.of("items", items));
    }

    // RECQ-US-002 — manual issuance against an existing visit.
    @PostMapping("/api/v1/queue/tokens")
    public ResponseEntity<QueueTokenResponse> issueManual(@Valid @RequestBody IssueManualTokenRequest request,
                                                            @AuthenticationPrincipal AuthenticatedPrincipal staff) {
        QueueToken token = queueService.issueManualToken(request.visitId(), request.priority(), staff.userId());
        return ResponseEntity.status(HttpStatus.CREATED).body(QueueTokenResponse.from(token));
    }

    // RECQ-US-004 — calls whichever token findActiveQueue() already ranks
    // first (highest priority, then longest-waiting); the caller doesn't
    // pick which one.
    @PostMapping("/api/v1/queue/call-next")
    public ResponseEntity<QueueEntryResponse> callNext(@RequestParam UUID facilityId,
                                                         @AuthenticationPrincipal AuthenticatedPrincipal staff) {
        QueueService.QueueEntryView called = queueService.callNext(facilityId, staff.userId());
        return ResponseEntity.ok(QueueEntryResponse.from(called));
    }

    @GetMapping("/api/v1/queue/open")
    public ResponseEntity<Map<String, Object>> open(@RequestParam UUID facilityId) {
        return ResponseEntity.ok(Map.of("items", queueService.listOpenQueueView(facilityId).stream()
                .map(QueueEntryResponse::from).toList()));
    }

    @GetMapping("/api/v1/queue/cancellation-reasons")
    public List<CancellationReason> cancellationReasons() {
        return List.of(CancellationReason.values());
    }

    @PostMapping("/api/v1/queue/tokens/{tokenId}/transition")
    public QueueTokenResponse transition(@org.springframework.web.bind.annotation.PathVariable UUID tokenId,
            @Valid @RequestBody TransitionRequest request,
            @AuthenticationPrincipal AuthenticatedPrincipal staff) {
        return QueueTokenResponse.from(queueService.transition(tokenId, request.action(), request.reasonCode(), staff.userId()));
    }

    public record TransitionRequest(@NotNull QueueService.TokenAction action, CancellationReason reasonCode) {
        @jakarta.validation.constraints.AssertTrue(message = "A cancellation reason code is required")
        public boolean isCancellationReasonValid() {
            return action != QueueService.TokenAction.CANCEL || reasonCode != null;
        }
    }

    public record IssueManualTokenRequest(@NotNull UUID visitId, @NotNull TokenPriority priority) {
    }

    public record QueueEntryResponse(QueueTokenResponse token, String patientName, String patientMpi) {
        static QueueEntryResponse from(QueueService.QueueEntryView view) {
            return new QueueEntryResponse(QueueTokenResponse.from(view.token()), view.patientName(),
                    view.patientMpi());
        }
    }
}
