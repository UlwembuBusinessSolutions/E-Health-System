package co.ehealth.platform.visit;

import co.ehealth.platform.core.security.AuthenticatedPrincipal;
import co.ehealth.platform.visit.VisitController.VisitResponse;
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

@RestController
public class VisitController {

    private final VisitService visitService;

    public VisitController(VisitService visitService) {
        this.visitService = visitService;
    }

    @PostMapping("/api/v1/visits")
    public ResponseEntity<VisitWithTokenResponse> create(
            @Valid @RequestBody CreateVisitRequest request,
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

    public record CreateVisitRequest(
            @NotNull UUID patientId,
            @NotNull UUID facilityId,
            @NotNull VisitType visitType,
            @NotNull ServiceStream serviceStream) {
    }

    // public record VisitResponse(UUID id, UUID patientId, UUID facilityId,
    // VisitType visitType, ServiceStream serviceStream, Instant visitDateTime)
    // {
    // static VisitResponse from(Visit v)
    // {
    // return new VisitResponse(v.getId(), v.getPatientId(),
    // v.getFacilityId(), v.getVisitType(), v.getServiceStream(),
    // v.getVisitDateTime());
    // }
    // }

    public record VisitResponse(UUID id, UUID patientId, UUID facilityId, VisitType visitType,
            ServiceStream serviceStream, Instant visitDateTime, UUID createdByUserId) {
        static VisitResponse from(Visit v) {
            return new VisitResponse(v.getId(), v.getPatientId(), v.getFacilityId(), v.getVisitType(),
                    v.getServiceStream(), v.getVisitDateTime(), v.getCreatedByUserId());
        }
    }

    public record VisitWithTokenResponse(VisitResponse visit, QueueTokenResponse token) {
        static VisitWithTokenResponse from(VisitService.VisitWithToken result) {
            return new VisitWithTokenResponse(VisitResponse.from(result.visit()),
                    QueueTokenResponse.from(result.token()));
        }
    }
}
