package co.ehealth.platform.pharmacy;

import co.ehealth.platform.core.audit.AuditLogService;
import co.ehealth.platform.core.clinic.ClinicContext;
import co.ehealth.platform.core.security.AuthenticatedPrincipal;
import co.ehealth.platform.core.tenant.ModuleCode;
import co.ehealth.platform.identity.PermissionLevel;
import co.ehealth.platform.identity.PermissionService;
import co.ehealth.platform.patient.PatientService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import java.time.Clock;
import java.util.*;

/** Tenant-maintained clinical reference data. Rules are deliberately explicit and auditable rather than hidden in code. */
@RestController
@RequestMapping("/api/v1/clinical-safety")
public class ClinicalSafetyController {
    private final DrugSafetyRuleRepository rules;
    private final PatientClinicalFactRepository facts;
    private final PatientService patients;
    private final PermissionService permissions;
    private final AuditLogService audit;
    private final Clock clock;
    public ClinicalSafetyController(DrugSafetyRuleRepository rules, PatientClinicalFactRepository facts, PatientService patients,
                                    PermissionService permissions, AuditLogService audit, Clock clock) {
        this.rules = rules; this.facts = facts; this.patients = patients; this.permissions = permissions; this.audit = audit; this.clock = clock;
    }
    @GetMapping("/rules") public Map<String, Object> rules() {
        permissions.requireAccess(ModuleCode.PHRM, PermissionLevel.VIEW); return Map.of("items", rules.findAllByOrderBySeverityDesc());
    }
    @PostMapping("/rules") public ResponseEntity<DrugSafetyRule> addRule(@Valid @RequestBody RuleRequest request,
            @AuthenticationPrincipal AuthenticatedPrincipal staff) {
        permissions.requireAccess(ModuleCode.PHRM, PermissionLevel.MANAGE);
        if ((request.type() == ClinicalRuleType.DRUG_INTERACTION) == (blank(request.relatedDrugName())))
            throw new IllegalArgumentException("An interaction needs relatedDrugName; a contraindication needs clinicalTerm.");
        if ((request.type() == ClinicalRuleType.CONTRAINDICATION) == blank(request.clinicalTerm()))
            throw new IllegalArgumentException("An interaction needs relatedDrugName; a contraindication needs clinicalTerm.");
        DrugSafetyRule rule = rules.save(new DrugSafetyRule(request.type(), request.drugName(), request.relatedDrugName(), request.clinicalTerm(), request.severity(), request.message()));
        audit.append(staff.userId(), ClinicContext.require(), "CLINICAL_RULE_CREATED", "DrugSafetyRule", rule.getId().toString(), null, null);
        return ResponseEntity.status(HttpStatus.CREATED).body(rule);
    }
    @GetMapping("/patients/{patientId}/facts") public Map<String, Object> facts(@PathVariable UUID patientId) {
        permissions.requireAccess(ModuleCode.PHRM, PermissionLevel.VIEW); patients.get(patientId); return Map.of("items", facts.findByPatientId(patientId));
    }
    @PostMapping("/patients/{patientId}/facts") public ResponseEntity<PatientClinicalFact> addFact(@PathVariable UUID patientId,
            @Valid @RequestBody FactRequest request, @AuthenticationPrincipal AuthenticatedPrincipal staff) {
        permissions.requireAccess(ModuleCode.PHRM, PermissionLevel.MANAGE); patients.get(patientId);
        if (facts.existsByPatientIdAndTypeAndTermIgnoreCase(patientId, request.type(), request.term()))
            return ResponseEntity.status(HttpStatus.CONFLICT).build();
        PatientClinicalFact fact = facts.save(new PatientClinicalFact(patientId, request.type(), request.term().trim(), clock.instant()));
        audit.append(staff.userId(), ClinicContext.require(), "PATIENT_CLINICAL_FACT_RECORDED", "PatientClinicalFact", fact.getId().toString(), null, null);
        return ResponseEntity.status(HttpStatus.CREATED).body(fact);
    }
    private boolean blank(String value) { return value == null || value.isBlank(); }
    public record RuleRequest(@NotNull ClinicalRuleType type, @NotBlank String drugName, String relatedDrugName,
                              String clinicalTerm, @NotNull ClinicalSeverity severity, @NotBlank String message) { }
    public record FactRequest(@NotNull PatientClinicalFact.Type type, @NotBlank String term) { }
}
