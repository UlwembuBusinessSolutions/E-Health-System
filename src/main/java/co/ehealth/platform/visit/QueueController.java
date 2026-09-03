package co.ehealth.platform.visit;

import co.ehealth.platform.core.security.AuthenticatedPrincipal;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
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

    // RECQ-US-007 — `search` is optional and matches token number, patient
    // name, or MPI (QueueService.matchesSearch()). Always scoped to today.
    @GetMapping("/api/v1/queue")
    public ResponseEntity<Map<String, Object>> list(@RequestParam UUID facilityId,
                                                       @RequestParam(required = false) String search) {
        List<QueueEntryResponse> items =
                queueService.listActiveQueueView(facilityId, search).stream().map(QueueEntryResponse::from).toList();
        return ResponseEntity.ok(Map.of("items", items));
    }

    // RECQ-US-002 — manual issuance against an existing visit. This creates
    // a genuinely new token/token-number; it is NOT how boosting an
    // already-waiting patient's priority works (see updatePriority() below)
    // — this is for a visit that doesn't currently have an active token at
    // all (a fresh walk-in intake, or deliberately re-queuing from scratch).
    @PostMapping("/api/v1/queue/tokens")
    public ResponseEntity<QueueTokenResponse> issueManual(@Valid @RequestBody IssueManualTokenRequest request,
                                                            @AuthenticationPrincipal AuthenticatedPrincipal staff) {
        QueueToken token = queueService.issueManualToken(request.visitId(), request.priority(), staff.userId());
        return ResponseEntity.status(HttpStatus.CREATED).body(QueueTokenResponse.from(token));
    }

    // The queue page's "Boost to priority" action — changes the existing
    // token's priority in place. Deliberately a different endpoint from
    // issueManual() above: that one creates a new token, which is exactly
    // the bug this fixes (boosting used to spawn a second row for the same
    // visit instead of moving the existing one up the queue).
    @PatchMapping("/api/v1/queue/tokens/{id}/priority")
    public ResponseEntity<QueueEntryResponse> updatePriority(@PathVariable UUID id,
                                                                @Valid @RequestBody UpdatePriorityRequest request,
                                                                @AuthenticationPrincipal AuthenticatedPrincipal staff) {
        return ResponseEntity
                .ok(QueueEntryResponse.from(queueService.updatePriority(id, request.priority(), staff.userId())));
    }

    // RECQ-US-004 — calls whichever token findCallableQueue() already
    // ranks first (highest priority, then longest-waiting) among today's
    // ISSUED tokens; the caller doesn't pick which one.
    @PostMapping("/api/v1/queue/call-next")
    public ResponseEntity<QueueEntryResponse> callNext(@RequestParam UUID facilityId,
                                                         @AuthenticationPrincipal AuthenticatedPrincipal staff) {
        QueueService.QueueEntryView called = queueService.callNext(facilityId, staff.userId());
        return ResponseEntity.ok(QueueEntryResponse.from(called));
    }

    // The out-and-back scenario, step one — the patient didn't respond to
    // the call.
    @PostMapping("/api/v1/queue/tokens/{id}/missed")
    public ResponseEntity<QueueEntryResponse> markMissed(@PathVariable UUID id,
                                                           @AuthenticationPrincipal AuthenticatedPrincipal staff) {
        return ResponseEntity.ok(QueueEntryResponse.from(queueService.markMissed(id, staff.userId())));
    }

    // Step two — the patient is back; re-inserted at their original place.
    @PostMapping("/api/v1/queue/tokens/{id}/recall")
    public ResponseEntity<QueueEntryResponse> recall(@PathVariable UUID id,
                                                        @AuthenticationPrincipal AuthenticatedPrincipal staff) {
        return ResponseEntity.ok(QueueEntryResponse.from(queueService.recall(id, staff.userId())));
    }

    @PostMapping("/api/v1/queue/tokens/{id}/complete")
    public ResponseEntity<QueueEntryResponse> complete(@PathVariable UUID id,
                                                          @AuthenticationPrincipal AuthenticatedPrincipal staff) {
        return ResponseEntity.ok(QueueEntryResponse.from(queueService.complete(id, staff.userId())));
    }

    @PostMapping("/api/v1/queue/tokens/{id}/cancel")
    public ResponseEntity<QueueEntryResponse> cancel(@PathVariable UUID id,
                                                        @Valid @RequestBody CancelTokenRequest request,
                                                        @AuthenticationPrincipal AuthenticatedPrincipal staff) {
        return ResponseEntity.ok(QueueEntryResponse.from(queueService.cancel(id, request.reason(), staff.userId())));
    }

    public record IssueManualTokenRequest(@NotNull UUID visitId, @NotNull TokenPriority priority) {
    }

    public record UpdatePriorityRequest(@NotNull TokenPriority priority) {
    }

    public record CancelTokenRequest(@NotBlank String reason) {
    }

    public record QueueEntryResponse(QueueTokenResponse token, String patientName, String patientMpi) {
        static QueueEntryResponse from(QueueService.QueueEntryView view) {
            return new QueueEntryResponse(QueueTokenResponse.from(view.token()), view.patientName(),
                    view.patientMpi());
        }
    }
}
