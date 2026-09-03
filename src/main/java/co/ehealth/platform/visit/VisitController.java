package co.ehealth.platform.visit;

import co.ehealth.platform.core.security.AuthenticatedPrincipal;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.UUID;

// No @RequestMapping("/api/v1/admin/...") — starting a patient's visit is
// front-line reception/clinical work, same reasoning as PatientController's
// own why-note. Falls through to .anyRequest().authenticated().
@RestController
public class VisitController {

    private final VisitService visitService;

    public VisitController(VisitService visitService) {
        this.visitService = visitService;
    }

    // PREG-US-019 + RECQ-US-001 — creates the visit and, in the same
    // transaction, issues its queue token (VisitService.createVisit()'s
    // own why-note). The response carries both so the reception UI can
    // show the token number immediately, without a second round trip.
    @PostMapping("/api/v1/visits")
    public ResponseEntity<VisitWithTokenResponse> create(@Valid @RequestBody CreateVisitRequest request,
                                                           @AuthenticationPrincipal AuthenticatedPrincipal staff) {
        var command = new VisitService.CreateVisitCommand(request.patientId(), request.facilityId(),
                request.visitType(), request.serviceStream());
        VisitService.VisitWithToken result = visitService.createVisit(command, staff.userId());
        return ResponseEntity.status(HttpStatus.CREATED).body(VisitWithTokenResponse.from(result));
    }

    @GetMapping("/api/v1/visits/{id}")
    public ResponseEntity<VisitResponse> get(@PathVariable UUID id) {
        return ResponseEntity.ok(VisitResponse.from(visitService.get(id)));
    }

    public record CreateVisitRequest(@NotNull UUID patientId, @NotNull UUID facilityId,
                                      @NotNull VisitType visitType, @NotNull ServiceStream serviceStream) {
    }

    public record VisitResponse(UUID id, UUID patientId, UUID facilityId, VisitType visitType,
                                 ServiceStream serviceStream, Instant visitDateTime) {
        static VisitResponse from(Visit v) {
            return new VisitResponse(v.getId(), v.getPatientId(), v.getFacilityId(), v.getVisitType(),
                    v.getServiceStream(), v.getVisitDateTime());
        }
    }

    public record VisitWithTokenResponse(VisitResponse visit, QueueTokenResponse token) {
        static VisitWithTokenResponse from(VisitService.VisitWithToken result) {
            return new VisitWithTokenResponse(VisitResponse.from(result.visit()),
                    QueueTokenResponse.from(result.token()));
        }
    }
}
