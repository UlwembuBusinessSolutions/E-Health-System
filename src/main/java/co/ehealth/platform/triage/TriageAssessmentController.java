package co.ehealth.platform.triage;

import co.ehealth.platform.core.security.AuthenticatedPrincipal;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@RestController
public class TriageAssessmentController {
    private final TriageAssessmentService triageAssessmentService;
    public TriageAssessmentController(TriageAssessmentService triageAssessmentService) { this.triageAssessmentService = triageAssessmentService; }

    @PostMapping("/api/v1/visits/{visitId}/triage-assessments")
    public ResponseEntity<CaptureVitalsResponse> capture(@PathVariable UUID visitId, @Valid @RequestBody CaptureVitalsRequest request,
                                                           @AuthenticationPrincipal AuthenticatedPrincipal staff) {
        var result = triageAssessmentService.capture(new TriageAssessmentService.CaptureVitalsCommand(visitId,
                request.systolicBloodPressure(), request.diastolicBloodPressure(), request.heartRate(),
                request.temperatureCelsius(), request.respiratoryRate(), request.avpu(), request.confirmOutOfRange()), staff.userId());
        return ResponseEntity.status(HttpStatus.CREATED).body(CaptureVitalsResponse.from(result));
    }

    public record CaptureVitalsRequest(@Positive int systolicBloodPressure, @Positive int diastolicBloodPressure,
                                       @Positive int heartRate, @NotNull @DecimalMin("1.0") @DecimalMax("99.9") BigDecimal temperatureCelsius,
                                       @Positive int respiratoryRate, @NotNull AvpuLevel avpu, boolean confirmOutOfRange) { }
    public record VitalSignsResponse(UUID id, UUID visitId, UUID patientId, int systolicBloodPressure, int diastolicBloodPressure,
                                     int heartRate, BigDecimal temperatureCelsius, int respiratoryRate, AvpuLevel avpu,
                                     Instant capturedAt, UUID capturedByUserId) {
        static VitalSignsResponse from(TriageAssessment a) { return new VitalSignsResponse(a.getId(), a.getVisitId(), a.getPatientId(), a.getSystolicBloodPressure(), a.getDiastolicBloodPressure(), a.getHeartRate(), a.getTemperatureCelsius(), a.getRespiratoryRate(), a.getAvpu(), a.getCapturedAt(), a.getCapturedByUserId()); }
    }
    public record CaptureVitalsResponse(VitalSignsResponse assessment, VitalSignsResponse priorAssessment) {
        static CaptureVitalsResponse from(TriageAssessmentService.CaptureResult result) { return new CaptureVitalsResponse(VitalSignsResponse.from(result.assessment()), result.priorAssessment() == null ? null : VitalSignsResponse.from(result.priorAssessment())); }
    }
}
