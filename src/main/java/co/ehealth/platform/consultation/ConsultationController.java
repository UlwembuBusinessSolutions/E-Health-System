package co.ehealth.platform.consultation;

import co.ehealth.platform.core.security.AuthenticatedPrincipal;
import co.ehealth.platform.identity.StaffService;
import co.ehealth.platform.pharmacy.PrescriptionService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

// No @RequestMapping("/api/v1/admin/...") — same reasoning as
// TriageController's own why-note: this is front-line clinical work,
// gated by ConsultationService's own permission + role checks, not by an
// admin-only route prefix.
@RestController
public class ConsultationController {

    private final ConsultationService consultationService;
    private final StaffService staffService;

    public ConsultationController(ConsultationService consultationService, StaffService staffService) {
        this.consultationService = consultationService;
        this.staffService = staffService;
    }

    @PostMapping("/api/v1/visits/{visitId}/consultations")
    public ResponseEntity<ConsultationResponse> createDraft(@PathVariable UUID visitId,
                                                              @AuthenticationPrincipal AuthenticatedPrincipal staff) {
        Consultation consultation = consultationService.createDraft(visitId, staff.userId());
        return ResponseEntity.status(HttpStatus.CREATED).body(toResponse(consultation));
    }

    // Full history, oldest first. One bulk name lookup for the whole list
    // (authorName/signedByName — "who consulted this patient," the patient
    // record's own why-note on why this matters) rather than one query per
    // entry — StaffService.resolveUserNames()'s own reason for taking a Set.
    @GetMapping("/api/v1/visits/{visitId}/consultations")
    public ResponseEntity<Map<String, Object>> history(@PathVariable UUID visitId) {
        List<Consultation> consultations = consultationService.getHistory(visitId);
        Map<UUID, String> names = resolveNames(consultations);
        var items = consultations.stream().map(c -> toResponse(c, names)).toList();
        return ResponseEntity.ok(Map.of("items", items));
    }

    // Wrapped in a nullable "item" rather than a bare 404 — no consultation
    // yet is an ordinary, expected state for a visit that hasn't reached
    // this step, not an error.
    @GetMapping("/api/v1/visits/{visitId}/consultations/current")
    public ResponseEntity<Map<String, Object>> current(@PathVariable UUID visitId) {
        var item = consultationService.getCurrent(visitId).map(this::toResponse).orElse(null);
        Map<String, Object> body = new HashMap<>();
        body.put("item", item);
        return ResponseEntity.ok(body);
    }

    @PatchMapping("/api/v1/consultations/{id}")
    public ResponseEntity<ConsultationResponse> updateDraft(@PathVariable UUID id,
                                                              @Valid @RequestBody UpdateConsultationRequest request,
                                                              @AuthenticationPrincipal AuthenticatedPrincipal staff) {
        var cmd = new ConsultationService.UpdateConsultationCommand(request.relevantHistory(),
                request.currentMedications(), request.allergyStatus(), request.allergyDetail(),
                request.examinationNotes(), request.investigationsNotes(), request.treatmentPlan());
        Consultation consultation = consultationService.updateDraft(id, cmd, staff.userId());
        return ResponseEntity.ok(toResponse(consultation));
    }

    @PostMapping("/api/v1/consultations/{id}/diagnoses")
    public ResponseEntity<DiagnosisResponse> addDiagnosis(@PathVariable UUID id,
                                                            @Valid @RequestBody DiagnosisRequest request,
                                                            @AuthenticationPrincipal AuthenticatedPrincipal staff) {
        ConsultationDiagnosis diagnosis = consultationService.addDiagnosis(id, request.diagnosisText(),
                request.isPrimary(), request.certainty(), staff.userId());
        return ResponseEntity.status(HttpStatus.CREATED).body(DiagnosisResponse.from(diagnosis));
    }

    @DeleteMapping("/api/v1/consultations/{id}/diagnoses/{diagnosisId}")
    public ResponseEntity<Void> removeDiagnosis(@PathVariable UUID id, @PathVariable UUID diagnosisId,
                                                 @AuthenticationPrincipal AuthenticatedPrincipal staff) {
        consultationService.removeDiagnosis(id, diagnosisId, staff.userId());
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/api/v1/consultations/{id}/sign")
    public ResponseEntity<ConsultationResponse> sign(@PathVariable UUID id,
                                                       @Valid @RequestBody SignConsultationRequest request,
                                                       @AuthenticationPrincipal AuthenticatedPrincipal staff) {
        Consultation consultation = consultationService.sign(id, request.outcome(), request.outcomeNotes(),
                toPharmacyItems(request.pharmacyItems()), request.destinationFacilityId(), staff.userId());
        return ResponseEntity.ok(toResponse(consultation));
    }

    @PostMapping("/api/v1/consultations/{id}/amend")
    public ResponseEntity<ConsultationResponse> amend(@PathVariable UUID id,
                                                        @Valid @RequestBody AmendConsultationRequest request,
                                                        @AuthenticationPrincipal AuthenticatedPrincipal staff) {
        var diagnoses = request.diagnoses().stream()
                .map(d -> new ConsultationService.DiagnosisInput(d.diagnosisText(), d.isPrimary(), d.certainty()))
                .toList();
        var cmd = new ConsultationService.AmendConsultationCommand(request.relevantHistory(),
                request.currentMedications(), request.allergyStatus(), request.allergyDetail(),
                request.examinationNotes(), request.investigationsNotes(), request.treatmentPlan(), diagnoses,
                request.outcome(), request.outcomeNotes(), request.amendmentReason(),
                toPharmacyItems(request.pharmacyItems()), request.destinationFacilityId());
        Consultation amendment = consultationService.amend(id, cmd, staff.userId());
        return ResponseEntity.status(HttpStatus.CREATED).body(toResponse(amendment));
    }

    // null (outcome isn't SEND_TO_PHARMACY, the client omitted the field
    // entirely) passes straight through — ConsultationService's own
    // requirePharmacyItemsIfNeeded() is what actually enforces "required
    // when the outcome needs it," not this mapping.
    private static List<PrescriptionService.PrescriptionItemInput> toPharmacyItems(
            List<PharmacyItemRequest> items) {
        return items == null ? null
                : items.stream().map(i -> new PrescriptionService.PrescriptionItemInput(i.drugName(), i.dosage(),
                        i.quantity())).toList();
    }

    @PostMapping("/api/v1/consultations/{id}/entered-in-error")
    public ResponseEntity<ConsultationResponse> markEnteredInError(@PathVariable UUID id,
                                                                     @Valid @RequestBody ReasonRequest request,
                                                                     @AuthenticationPrincipal AuthenticatedPrincipal staff) {
        Consultation consultation = consultationService.markEnteredInError(id, request.reason(), staff.userId());
        return ResponseEntity.ok(toResponse(consultation));
    }

    private ConsultationResponse toResponse(Consultation c) {
        return toResponse(c, resolveNames(List.of(c)));
    }

    private ConsultationResponse toResponse(Consultation c, Map<UUID, String> names) {
        var diagnoses = consultationService.getDiagnoses(c.getId()).stream().map(DiagnosisResponse::from).toList();
        return ConsultationResponse.from(c, diagnoses, names.get(c.getAuthorUserId()),
                c.getSignedByUserId() == null ? null : names.get(c.getSignedByUserId()));
    }

    private Map<UUID, String> resolveNames(List<Consultation> consultations) {
        Set<UUID> userIds = new HashSet<>();
        for (Consultation c : consultations) {
            userIds.add(c.getAuthorUserId());
            if (c.getSignedByUserId() != null) {
                userIds.add(c.getSignedByUserId());
            }
        }
        return staffService.resolveUserNames(userIds);
    }

    public record UpdateConsultationRequest(String relevantHistory, String currentMedications,
                                              @NotNull AllergyStatus allergyStatus, String allergyDetail,
                                              String examinationNotes, String investigationsNotes,
                                              String treatmentPlan) {
    }

    public record DiagnosisRequest(@NotBlank String diagnosisText, boolean isPrimary,
                                    DiagnosisCertainty certainty) {
    }

    // Required only when outcome is SEND_TO_PHARMACY (ConsultationService.
    // requirePharmacyItemsIfNeeded()) — omitted/null for every other
    // outcome, same as PrescriptionController.ItemRequest's own shape.
    public record PharmacyItemRequest(@NotBlank String drugName, @NotBlank String dosage,
                                       @Positive int quantity) {
    }

    public record SignConsultationRequest(@NotNull ConsultationOutcome outcome, String outcomeNotes,
                                           List<@Valid PharmacyItemRequest> pharmacyItems,
                                           UUID destinationFacilityId) {
    }

    public record AmendConsultationRequest(String relevantHistory, String currentMedications,
                                            @NotNull AllergyStatus allergyStatus, String allergyDetail,
                                            String examinationNotes, String investigationsNotes,
                                            String treatmentPlan, List<DiagnosisRequest> diagnoses,
                                            @NotNull ConsultationOutcome outcome, String outcomeNotes,
                                            @NotBlank String amendmentReason,
                                            List<@Valid PharmacyItemRequest> pharmacyItems,
                                            UUID destinationFacilityId) {
    }

    public record ReasonRequest(@NotBlank String reason) {
    }

    public record DiagnosisResponse(UUID id, String diagnosisText, boolean isPrimary, DiagnosisCertainty certainty,
                                     int sortOrder, String codingSystem, String catalogueVersion, String code,
                                     String displayText) {
        static DiagnosisResponse from(ConsultationDiagnosis d) {
            return new DiagnosisResponse(d.getId(), d.getDiagnosisText(), d.isPrimary(), d.getCertainty(),
                    d.getSortOrder(), d.getCodingSystem(), d.getCatalogueVersion(), d.getCode(), d.getDisplayText());
        }
    }

    // createdAt/signedAt double as this consultation's start/end — there's
    // no separate "examination started" moment distinct from the draft
    // being created (ConsultationService.createDraft()), nor a "finished"
    // moment distinct from signing. authorName/signedByName resolve
    // authorUserId/signedByUserId to real names — "who consulted this
    // patient," same reasoning PrescriptionResponse already applies to
    // prescriberName/dispensedByName.
    public record ConsultationResponse(UUID id, UUID visitId, ConsultationStatus status,
                                        UUID supersedesConsultationId, String amendmentReason, UUID authorUserId,
                                        String authorName, UUID signedByUserId, String signedByName,
                                        Instant signedAt, String relevantHistory, String currentMedications,
                                        AllergyStatus allergyStatus, String allergyDetail, String examinationNotes,
                                        String investigationsNotes, String treatmentPlan,
                                        ConsultationOutcome outcome, String outcomeNotes, Instant createdAt,
                                        Instant updatedAt, List<DiagnosisResponse> diagnoses) {
        static ConsultationResponse from(Consultation c, List<DiagnosisResponse> diagnoses, String authorName,
                                          String signedByName) {
            return new ConsultationResponse(c.getId(), c.getVisitId(), c.getStatus(),
                    c.getSupersedesConsultationId(), c.getAmendmentReason(), c.getAuthorUserId(), authorName,
                    c.getSignedByUserId(), signedByName, c.getSignedAt(), c.getRelevantHistory(),
                    c.getCurrentMedications(), c.getAllergyStatus(), c.getAllergyDetail(), c.getExaminationNotes(),
                    c.getInvestigationsNotes(), c.getTreatmentPlan(), c.getOutcome(), c.getOutcomeNotes(),
                    c.getCreatedAt(), c.getUpdatedAt(), diagnoses);
        }
    }
}
