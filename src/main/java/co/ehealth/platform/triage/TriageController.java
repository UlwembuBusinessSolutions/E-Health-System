package co.ehealth.platform.triage;

import co.ehealth.platform.core.security.AuthenticatedPrincipal;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

// No @RequestMapping("/api/v1/admin/...") — same reasoning as
// VisitController/QueueController's own why-notes: capturing vitals is
// front-line clinical work, gated by TriageService's own permission +
// role checks, not by an admin-only route prefix.
@RestController
public class TriageController {

    private final TriageService triageService;

    public TriageController(TriageService triageService) {
        this.triageService = triageService;
    }

    @PostMapping("/api/v1/visits/{visitId}/triage")
    public ResponseEntity<TriageAssessmentResponse> capture(@PathVariable UUID visitId,
                                                              @Valid @RequestBody CaptureTriageRequest request,
                                                              @AuthenticationPrincipal AuthenticatedPrincipal staff) {
        var cmd = new TriageService.TriageCaptureCommand(visitId, request.emergencySign(),
                request.emergencySignNote(), request.scoringProfileOverride(), request.respiratoryRate(),
                request.heartRate(), request.systolicBp(), request.diastolicBp(), request.temperatureCelsius(),
                request.spo2Percent(), request.oxygenSupport(), request.oxygenDevice(), request.oxygenFlowLpm(),
                request.avpu(), request.mobility(), request.painScore(), request.painScale(),
                request.presentingComplaint(), request.discriminators(), request.supersedesAssessmentId(),
                request.observedAt(), request.idempotencyKey(), request.confirmOutOfRange(),
                request.clinicianConfirmedColour(), request.colourConfirmationReason(), request.additionalObservations());
        TriageAssessment assessment = triageService.capture(cmd, staff.userId());
        return ResponseEntity.status(HttpStatus.CREATED).body(TriageAssessmentResponse.from(assessment));
    }

    // Oldest first — the full timeline for this visit, ACTIVE and
    // corrected/superseded entries alike, so a reviewer can see both what
    // is current and what was corrected along the way.
    @GetMapping("/api/v1/visits/{visitId}/triage")
    public ResponseEntity<Map<String, Object>> history(@PathVariable UUID visitId) {
        var items = triageService.getHistory(visitId).stream().map(TriageAssessmentResponse::from).toList();
        return ResponseEntity.ok(Map.of("items", items));
    }

    // Wrapped in a nullable "item" rather than a bare 404 — no assessment
    // yet is an ordinary, expected state for a visit that hasn't reached
    // triage, not an error.
    @GetMapping("/api/v1/visits/{visitId}/triage/latest")
    public ResponseEntity<Map<String, Object>> latest(@PathVariable UUID visitId) {
        var item = triageService.getLatestActive(visitId).map(TriageAssessmentResponse::from).orElse(null);
        Map<String, Object> body = new HashMap<>();
        body.put("item", item);
        return ResponseEntity.ok(body);
    }

    // The patient-level Vitals tab (PatientDetailPage) — every capture
    // across every visit this patient has had, each one annotated with who
    // captured it. from/to (yyyy-mm-dd) are both optional; omitting either
    // or both leaves that side of the date range unbounded. Newest first by
    // default; ascending=true reverses that. Paginated the same shape
    // QueueController's own /api/v1/queue list already uses (page/pageSize
    // in, items/page/pageSize/totalElements/totalPages out).
    @GetMapping("/api/v1/patients/{patientId}/vitals")
    public ResponseEntity<Map<String, Object>> patientVitalsHistory(@PathVariable UUID patientId,
                                                                      @RequestParam(required = false) LocalDate from,
                                                                      @RequestParam(required = false) LocalDate to,
                                                                      @RequestParam(defaultValue = "false") boolean ascending,
                                                                      @RequestParam(defaultValue = "0") int page,
                                                                      @RequestParam(defaultValue = "10") int pageSize) {
        TriageService.PatientVitalsHistoryPage result =
                triageService.getPatientVitalsHistory(patientId, from, to, ascending, page, pageSize);
        return ResponseEntity.ok(Map.of(
                "items", result.items().stream().map(PatientVitalsEntryResponse::from).toList(),
                "page", result.page(),
                "pageSize", result.pageSize(),
                "totalElements", result.totalElements(),
                "totalPages", result.totalPages()));
    }

    // VitalsPrintPage's fetch-by-id — the print button opens this in a
    // fresh popup tab, so it needs its own URL to load from rather than
    // relying on the assessment already being in memory client-side. Carries
    // the patient's name/MPI (TriageService.getAssessment()'s own why-note
    // on why that fresh tab needs them included here, unlike the list
    // endpoint above).
    @GetMapping("/api/v1/triage/{assessmentId}")
    public ResponseEntity<VitalsAssessmentDetailResponse> getAssessment(@PathVariable UUID assessmentId) {
        return ResponseEntity.ok(VitalsAssessmentDetailResponse.from(triageService.getAssessment(assessmentId)));
    }

    @PostMapping("/api/v1/triage/{assessmentId}/entered-in-error")
    public ResponseEntity<TriageAssessmentResponse> markEnteredInError(@PathVariable UUID assessmentId,
                                                                        @Valid @RequestBody ReasonRequest request,
                                                                        @AuthenticationPrincipal AuthenticatedPrincipal staff) {
        TriageAssessment assessment = triageService.markEnteredInError(assessmentId, request.reason(),
                staff.userId());
        return ResponseEntity.ok(TriageAssessmentResponse.from(assessment));
    }

    @PostMapping("/api/v1/triage/{assessmentId}/override")
    public ResponseEntity<TriageAssessmentResponse> override(@PathVariable UUID assessmentId,
                                                               @Valid @RequestBody OverrideRequest request,
                                                               @AuthenticationPrincipal AuthenticatedPrincipal staff) {
        TriageAssessment assessment =
                triageService.override(assessmentId, request.finalColour(), request.reason(), staff.userId());
        return ResponseEntity.ok(TriageAssessmentResponse.from(assessment));
    }

    public record CaptureTriageRequest(boolean emergencySign, String emergencySignNote,
                                        ScoringProfile scoringProfileOverride, Integer respiratoryRate,
                                        Integer heartRate, Integer systolicBp, Integer diastolicBp,
                                        Double temperatureCelsius, Integer spo2Percent, OxygenSupport oxygenSupport,
                                        String oxygenDevice, Double oxygenFlowLpm, Avpu avpu, Mobility mobility,
                                        Integer painScore, String painScale, String presentingComplaint,
                                        Set<TriageDiscriminator> discriminators, UUID supersedesAssessmentId,
                                        Instant observedAt, @NotBlank String idempotencyKey, boolean confirmOutOfRange,
                                        TriageColour clinicianConfirmedColour, String colourConfirmationReason, AdditionalObservations additionalObservations) {
    }

    public record ReasonRequest(@NotBlank String reason) {
    }

    public record OverrideRequest(@NotNull TriageColour finalColour, @NotBlank String reason) {
    }

    public record PatientVitalsEntryResponse(TriageAssessmentResponse assessment, String capturedByName) {
        static PatientVitalsEntryResponse from(TriageService.PatientVitalsView v) {
            return new PatientVitalsEntryResponse(TriageAssessmentResponse.from(v.assessment()), v.capturedByName());
        }
    }

    public record VitalsAssessmentDetailResponse(TriageAssessmentResponse assessment, String capturedByName,
                                                  String patientName, String patientMpi) {
        static VitalsAssessmentDetailResponse from(TriageService.VitalsAssessmentDetail d) {
            return new VitalsAssessmentDetailResponse(TriageAssessmentResponse.from(d.assessment()),
                    d.capturedByName(), d.patientName(), d.patientMpi());
        }
    }

    public record TriageAssessmentResponse(UUID id, UUID visitId, TriageAssessmentStatus status,
                                            UUID supersedesAssessmentId, String correctionReason,
                                            boolean emergencySign, String emergencySignNote,
                                            ScoringProfile scoringProfile, boolean profileManuallyConfirmed,
                                            Integer respiratoryRate, Integer heartRate, Integer systolicBp,
                                            Integer diastolicBp, Double temperatureCelsius, Integer spo2Percent,
                                            OxygenSupport oxygenSupport, String oxygenDevice, Double oxygenFlowLpm,
                                            Avpu avpu, Mobility mobility, Integer painScore, String painScale,
                                            String presentingComplaint, boolean outOfRangeConfirmed,
                                            String validationWarnings, Set<TriageDiscriminator> discriminators,
                                            Integer tewsScore, String scoringVersion, TriageColour calculatedColour,
                                            TriageColour finalColour, String overrideReason,
                                            UUID overriddenByUserId, UUID capturedByUserId, Instant observedAt,
                                            Instant recordedAt, AdditionalObservations additionalObservations) {
        static TriageAssessmentResponse from(TriageAssessment a) {
            return new TriageAssessmentResponse(a.getId(), a.getVisitId(), a.getStatus(),
                    a.getSupersedesAssessmentId(), a.getCorrectionReason(), a.isEmergencySign(),
                    a.getEmergencySignNote(), a.getScoringProfile(), a.isProfileManuallyConfirmed(),
                    a.getRespiratoryRate(), a.getHeartRate(), a.getSystolicBp(), a.getDiastolicBp(),
                    a.getTemperatureCelsius(), a.getSpo2Percent(), a.getOxygenSupport(), a.getOxygenDevice(),
                    a.getOxygenFlowLpm(), a.getAvpu(), a.getMobility(), a.getPainScore(), a.getPainScale(),
                    a.getPresentingComplaint(), a.isOutOfRangeConfirmed(), a.getValidationWarnings(),
                    a.getDiscriminators(), a.getTewsScore(), a.getScoringVersion(),
                    a.getCalculatedColour(), a.getFinalColour(), a.getOverrideReason(), a.getOverriddenByUserId(),
                    a.getCapturedByUserId(), a.getObservedAt(), a.getRecordedAt(), a.getAdditionalObservations());
        }
    }
}
