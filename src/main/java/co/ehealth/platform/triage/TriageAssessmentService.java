package co.ehealth.platform.triage;

import co.ehealth.platform.core.audit.AuditLogService;
import co.ehealth.platform.core.tenant.ModuleCode;
import co.ehealth.platform.identity.PermissionLevel;
import co.ehealth.platform.identity.PermissionService;
import co.ehealth.platform.visit.Visit;
import co.ehealth.platform.visit.VisitService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@Service
public class TriageAssessmentService {
    private final TriageAssessmentRepository assessments;
    private final VisitService visitService;
    private final AuditLogService auditLogService;
    private final PermissionService permissionService;
    private final Clock clock;

    public TriageAssessmentService(TriageAssessmentRepository assessments, VisitService visitService,
                                   AuditLogService auditLogService, PermissionService permissionService, Clock clock) {
        this.assessments = assessments;
        this.visitService = visitService;
        this.auditLogService = auditLogService;
        this.permissionService = permissionService;
        this.clock = clock;
    }

    @Transactional
    public CaptureResult capture(CaptureVitalsCommand command, UUID clinicianId) {
        permissionService.requireAccess(ModuleCode.RECQ, PermissionLevel.MANAGE);
        validate(command);
        Visit visit = visitService.get(command.visitId());
        Instant capturedAt = clock.instant();
        Optional<TriageAssessment> prior = assessments.findFirstByPatientIdOrderByCapturedAtDesc(visit.getPatientId());
        TriageAssessment assessment = assessments.save(new TriageAssessment(visit.getId(), visit.getPatientId(),
                command.systolicBloodPressure(), command.diastolicBloodPressure(), command.heartRate(),
                command.temperatureCelsius(), command.respiratoryRate(), command.avpu(), capturedAt, clinicianId));
        auditLogService.append(clinicianId, visit.getFacilityId(), "TRIAGE_VITALS_CAPTURED", "TriageAssessment",
                assessment.getId().toString(), null, null);
        return new CaptureResult(assessment, prior.orElse(null));
    }

    private void validate(CaptureVitalsCommand c) {
        Map<String, String> impossible = new LinkedHashMap<>();
        if (c.systolicBloodPressure() < 40 || c.systolicBloodPressure() > 300) impossible.put("systolicBloodPressure", "Must be between 40 and 300 mmHg.");
        if (c.diastolicBloodPressure() < 20 || c.diastolicBloodPressure() > 200) impossible.put("diastolicBloodPressure", "Must be between 20 and 200 mmHg.");
        if (c.diastolicBloodPressure() >= c.systolicBloodPressure()) impossible.put("diastolicBloodPressure", "Must be lower than systolic blood pressure.");
        if (c.heartRate() < 20 || c.heartRate() > 250) impossible.put("heartRate", "Must be between 20 and 250 bpm.");
        if (c.temperatureCelsius().compareTo(new BigDecimal("30.0")) < 0 || c.temperatureCelsius().compareTo(new BigDecimal("45.0")) > 0) impossible.put("temperatureCelsius", "Must be between 30.0 and 45.0 °C.");
        if (c.respiratoryRate() < 5 || c.respiratoryRate() > 80) impossible.put("respiratoryRate", "Must be between 5 and 80 breaths/min.");
        if (!impossible.isEmpty()) throw new ClinicalRangeException("Vital signs are outside clinically plausible ranges.", impossible);

        boolean abnormal = c.systolicBloodPressure() < 90 || c.systolicBloodPressure() > 180
                || c.diastolicBloodPressure() < 60 || c.diastolicBloodPressure() > 120
                || c.heartRate() < 50 || c.heartRate() > 120
                || c.temperatureCelsius().compareTo(new BigDecimal("35.0")) < 0 || c.temperatureCelsius().compareTo(new BigDecimal("38.0")) > 0
                || c.respiratoryRate() < 12 || c.respiratoryRate() > 20
                || c.avpu() != AvpuLevel.ALERT;
        if (abnormal && !c.confirmOutOfRange()) {
            throw new ClinicalRangeException("Out-of-range vital signs require confirmation before saving.",
                    Map.of("confirmOutOfRange", "Set to true to confirm these out-of-range observations."));
        }
    }

    public record CaptureVitalsCommand(UUID visitId, int systolicBloodPressure, int diastolicBloodPressure,
                                        int heartRate, BigDecimal temperatureCelsius, int respiratoryRate,
                                        AvpuLevel avpu, boolean confirmOutOfRange) { }
    public record CaptureResult(TriageAssessment assessment, TriageAssessment priorAssessment) { }
}
