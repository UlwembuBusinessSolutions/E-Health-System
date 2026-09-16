package co.ehealth.platform.pharmacy;

import co.ehealth.platform.core.security.AuthenticatedPrincipal;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import org.springframework.http.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import java.time.Instant;
import java.util.*;

@RestController
public class PrescriptionQueryController {
    private final PrescriptionQueryService queries;
    private final PrescriptionQueryLiveNotifier liveNotifier;
    public PrescriptionQueryController(PrescriptionQueryService queries, PrescriptionQueryLiveNotifier liveNotifier) { this.queries = queries; this.liveNotifier = liveNotifier; }

    @GetMapping("/api/v1/prescriptions/{prescriptionId}/query-preview")
    public Map<String, Object> preview(@PathVariable UUID prescriptionId) { return Map.of("alerts", queries.preview(prescriptionId)); }

    @PostMapping("/api/v1/prescriptions/{prescriptionId}/queries")
    public ResponseEntity<QueryResponse> raise(@PathVariable UUID prescriptionId, @Valid @RequestBody RaiseQueryRequest request,
                                                @AuthenticationPrincipal AuthenticatedPrincipal staff) {
        return ResponseEntity.status(HttpStatus.CREATED).body(toResponse(queries.raise(prescriptionId, request.reason(), staff.userId())));
    }

    @PostMapping("/api/v1/prescription-queries/{queryId}/response")
    public QueryResponse respond(@PathVariable UUID queryId, @Valid @RequestBody RespondQueryRequest request,
                                 @AuthenticationPrincipal AuthenticatedPrincipal staff) { return toResponse(queries.respond(queryId, request.response(), staff.userId())); }

    @GetMapping("/api/v1/prescription-queries")
    public Map<String, Object> list() { return Map.of("items", queries.list().stream().map(this::toResponse).toList()); }

    @GetMapping("/api/v1/prescription-query-notifications")
    public Map<String, Object> notifications(@AuthenticationPrincipal AuthenticatedPrincipal staff) { return Map.of("items", queries.notifications(staff.userId()).stream().map(this::toNotification).toList()); }

    @GetMapping(value = "/api/v1/prescription-query-notifications/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter stream(@AuthenticationPrincipal AuthenticatedPrincipal staff) { return liveNotifier.subscribe(staff.userId()); }

    private QueryResponse toResponse(PrescriptionQuery q) { return new QueryResponse(q.getId(), q.getPrescriptionId(), q.getRaisedByUserId(), q.getPrescriberId(), q.getReason(), q.getGuidelineWarning(), q.getStatus(), q.getPrescriberResponse(), q.getRaisedAt(), q.getRespondedAt()); }
    private NotificationResponse toNotification(PrescriptionQueryNotification n) { return new NotificationResponse(n.getId(), n.getQueryId(), n.getType(), n.getMessage(), n.getCreatedAt()); }
    public record RaiseQueryRequest(@NotBlank String reason) { }
    public record RespondQueryRequest(@NotBlank String response) { }
    public record QueryResponse(UUID id, UUID prescriptionId, UUID raisedByUserId, UUID prescriberId, String reason, String guidelineWarning, PrescriptionQueryStatus status, String prescriberResponse, Instant raisedAt, Instant respondedAt) { }
    public record NotificationResponse(UUID id, UUID queryId, String type, String message, Instant createdAt) { }
}
