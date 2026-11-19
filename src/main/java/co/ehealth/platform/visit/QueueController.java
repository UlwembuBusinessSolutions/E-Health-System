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

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Set;
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
                                                       @RequestParam(required = false) String search,
                                                       @RequestParam(required = false) Set<TokenStatus> status,
                                                       @RequestParam(required = false) TokenPriority priority,
                                                       @RequestParam(required = false) LocalDate date,
                                                       @RequestParam(defaultValue = "0") int page,
                                                       @RequestParam(defaultValue = "25") int pageSize) {
        QueueService.QueuePageView result =
                queueService.listQueueView(facilityId, search, status, priority, date, page, pageSize);
        return ResponseEntity.ok(Map.of(
                "items", result.items().stream().map(QueueEntryResponse::from).toList(),
                "page", result.page(),
                "pageSize", result.pageSize(),
                "totalElements", result.totalElements(),
                "totalPages", result.totalPages(),
                "date", result.date()));
    }

    // RECQ-US-003 — one token's full details (patient name/MPI included),
    // for the print/reprint ticket screen. Not date-restricted like the
    // row actions are: reprinting an old ticket for the record is harmless
    // even outside "today."
    @GetMapping("/api/v1/queue/tokens/{id}")
    public ResponseEntity<QueueEntryResponse> get(@PathVariable UUID id) {
        return ResponseEntity.ok(QueueEntryResponse.from(queueService.getToken(id)));
    }

    // The normalized event history (V21) for one token — every issue/call/
    // miss/reactivate/complete/cancel/priority-change, oldest first, each
    // with whoever performed it and any reason captured at the time.
    @GetMapping("/api/v1/queue/tokens/{id}/history")
    public ResponseEntity<Map<String, Object>> history(@PathVariable UUID id) {
        List<QueueTokenEventResponse> events =
                queueService.getTokenHistory(id).stream().map(QueueTokenEventResponse::from).toList();
        return ResponseEntity.ok(Map.of("items", events));
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
                .ok(QueueEntryResponse.from(queueService.updatePriority(id, request.priority(), request.reasonCode(),
                        request.reasonNote(), staff.userId())));
    }

    @PostMapping("/api/v1/queue/tokens/{id}/call")
    public ResponseEntity<QueueEntryResponse> callToken(@PathVariable UUID id,
                                                          @RequestBody(required = false) QueueReasonRequest request,
                                                          @AuthenticationPrincipal AuthenticatedPrincipal staff) {
        QueueReasonRequest reason = request != null ? request : new QueueReasonRequest(null, null);
        return ResponseEntity.ok(QueueEntryResponse.from(queueService.callToken(id, reason.reasonCode(),
                reason.reasonNote(), staff.userId())));
    }

    @PostMapping("/api/v1/queue/tokens/{id}/reactivate")
    public ResponseEntity<QueueEntryResponse> reactivate(@PathVariable UUID id,
                                                           @Valid @RequestBody QueueReasonRequest request,
                                                           @AuthenticationPrincipal AuthenticatedPrincipal staff) {
        return ResponseEntity.ok(QueueEntryResponse.from(queueService.reactivate(id, request.reasonCode(),
                request.reasonNote(), staff.userId())));
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

    // Cancels this ticket (with a note pointing at the destination facility)
    // and issues a brand-new one there against a brand-new Visit — see
    // QueueService.transferToken()'s own why-note for why a transfer isn't
    // modeled as moving the existing token/visit in place. The response is
    // the new token, at the destination facility, not the one that was
    // cancelled.
    @PostMapping("/api/v1/queue/tokens/{id}/transfer")
    public ResponseEntity<QueueEntryResponse> transfer(@PathVariable UUID id,
                                                          @Valid @RequestBody TransferTokenRequest request,
                                                          @AuthenticationPrincipal AuthenticatedPrincipal staff) {
        return ResponseEntity.ok(QueueEntryResponse.from(
                queueService.transferToken(id, request.destinationFacilityId(), request.reason(), staff.userId())));
    }

    public record IssueManualTokenRequest(@NotNull UUID visitId, @NotNull TokenPriority priority) {
    }

    public record UpdatePriorityRequest(@NotNull TokenPriority priority, @NotNull QueueActionReason reasonCode,
                                        String reasonNote) {
    }

    public record QueueReasonRequest(QueueActionReason reasonCode, String reasonNote) {
    }

    public record CancelTokenRequest(@NotBlank String reason) {
    }

    public record TransferTokenRequest(@NotNull UUID destinationFacilityId, String reason) {
    }

    public record QueueEntryResponse(QueueTokenResponse token, UUID patientId, String patientName,
                                      String patientMpi) {
        static QueueEntryResponse from(QueueService.QueueEntryView view) {
            return new QueueEntryResponse(QueueTokenResponse.from(view.token()), view.patientId(),
                    view.patientName(), view.patientMpi());
        }
    }

    public record QueueTokenEventResponse(UUID id, QueueTokenEventType eventType, TokenStatus fromStatus,
                                           TokenStatus toStatus, TokenPriority fromPriority, TokenPriority toPriority,
                                           QueueActionReason reasonCode, String reasonNote, UUID performedByUserId,
                                           Instant occurredAt) {
        static QueueTokenEventResponse from(QueueTokenEvent e) {
            return new QueueTokenEventResponse(e.getId(), e.getEventType(), e.getFromStatus(), e.getToStatus(),
                    e.getFromPriority(), e.getToPriority(), e.getReasonCode(), e.getReasonNote(),
                    e.getPerformedByUserId(), e.getOccurredAt());
        }
    }
}
