package co.ehealth.platform.visit;

import co.ehealth.platform.core.security.AuthenticatedPrincipal;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
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
    private final TicketPrinterService ticketPrinterService;

    public QueueController(QueueService queueService, TicketPrinterService ticketPrinterService) {
        this.queueService = queueService;
        this.ticketPrinterService = ticketPrinterService;
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

    // RECQ-US-003 — print physical ticket for a queue token.
    // Returns HTML that can be printed via browser, or plain text for terminal printers.
    @GetMapping("/api/v1/queue/tokens/{tokenId}/print")
    public ResponseEntity<String> printTicket(@PathVariable UUID tokenId,
                                              @RequestParam(defaultValue = "html") String format) {
        TicketData ticket = ticketPrinterService.generateTicket(tokenId);
        
        String output = switch (format.toLowerCase()) {
            case "text" -> TicketFormatter.generatePlainTextTicket(ticket);
            case "html" -> TicketFormatter.generateHtmlTicket(ticket);
            default -> TicketFormatter.generateHtmlTicket(ticket);
        };
        
        MediaType mediaType = format.equalsIgnoreCase("text") 
            ? MediaType.TEXT_PLAIN 
            : MediaType.TEXT_HTML;
        
        return ResponseEntity.ok()
                .contentType(mediaType)
                .body(output);
    }

    // RECQ-US-003 — Get ticket data as JSON (for integration with mobile apps, etc.)
    @GetMapping("/api/v1/queue/tokens/{tokenId}/ticket-data")
    public ResponseEntity<TicketData> getTicketData(@PathVariable UUID tokenId) {
        TicketData ticket = ticketPrinterService.generateTicket(tokenId);
        return ResponseEntity.ok(ticket);
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
