package co.ehealth.platform.pharmacy;

import co.ehealth.platform.core.security.AuthenticatedPrincipal;
import co.ehealth.platform.patient.Patient;
import co.ehealth.platform.patient.PatientService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
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
import java.util.List;
import java.util.Map;
import java.util.UUID;

// No @RequestMapping("/api/v1/admin/...") — the real gate here is
// StaffService.getLicenseStatus() inside PrescriptionService, not a role
// check. Same .anyRequest().authenticated() fallthrough as Patient/Visit/Queue.
@RestController
public class PrescriptionController {

    private final PrescriptionService prescriptionService;
    private final PatientService patientService;
    private final PrescriptionQueryRepository prescriptionQueries;

    public PrescriptionController(PrescriptionService prescriptionService, PatientService patientService,
                                  PrescriptionQueryRepository prescriptionQueries) {
        this.prescriptionService = prescriptionService;
        this.patientService = patientService;
        this.prescriptionQueries = prescriptionQueries;
    }

    @PostMapping("/api/v1/prescriptions")
    public ResponseEntity<PrescriptionResponse> create(@Valid @RequestBody CreatePrescriptionRequest request,
                                                         @AuthenticationPrincipal AuthenticatedPrincipal staff) {
        var items = request.items().stream()
                .map(i -> new PrescriptionService.PrescriptionItemInput(i.drugName(), i.dosage(), i.quantity()))
                .toList();
        var command = new PrescriptionService.CreatePrescriptionCommand(request.visitId(), items, request.overrideReason());
        Prescription prescription = prescriptionService.create(command, staff.userId());
        return ResponseEntity.status(HttpStatus.CREATED).body(toResponse(prescription));
    }

    @GetMapping("/api/v1/prescriptions/queue")
    public ResponseEntity<Map<String, Object>> queue(@RequestParam UUID facilityId) {
        List<PrescriptionResponse> items = prescriptionService.listQueue(facilityId).stream()
                .map(this::toResponse).toList();
        return ResponseEntity.ok(Map.of("items", items));
    }

    @GetMapping("/api/v1/prescriptions")
    public ResponseEntity<Map<String, Object>> list() {
        List<PrescriptionResponse> items = prescriptionService.list().stream().map(this::toResponse).toList();
        return ResponseEntity.ok(Map.of("items", items));
    }

    @GetMapping("/api/v1/prescriptions/stats")
    public ResponseEntity<Map<String, Long>> stats(@RequestParam UUID facilityId) {
        return ResponseEntity.ok(Map.of("dispensedToday", prescriptionService.countDispensedToday(facilityId)));
    }

    @GetMapping("/api/v1/prescriptions/{id}")
    public ResponseEntity<PrescriptionResponse> get(@PathVariable UUID id) {
        return ResponseEntity.ok(toResponse(prescriptionService.get(id)));
    }

    @PostMapping("/api/v1/prescriptions/{id}/dispense")
    public ResponseEntity<Void> dispense(@PathVariable UUID id,
                                          @RequestBody(required = false) DispenseRequest request,
                                          @AuthenticationPrincipal AuthenticatedPrincipal staff) {
        prescriptionService.dispense(id, staff.userId(), request == null ? null : request.overrideReason(),
                request == null ? null : request.coverageUntil());
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/api/v1/prescriptions/{id}/duplicate-warnings")
    public Map<String, Object> duplicateWarnings(@PathVariable UUID id) {
        return Map.of("items", prescriptionService.duplicateWarnings(id));
    }

    @PostMapping("/api/v1/prescriptions/{id}/decline")
    public ResponseEntity<PrescriptionDecline> decline(@PathVariable UUID id, @Valid @RequestBody DeclineRequest request,
            @AuthenticationPrincipal AuthenticatedPrincipal staff) {
        return ResponseEntity.status(HttpStatus.CREATED).body(
                prescriptionService.decline(id, staff.userId(), request.reasonCode(), request.reasonDetail()));
    }

    @GetMapping("/api/v1/prescriptions/{id}/decline")
    public PrescriptionDecline getDecline(@PathVariable UUID id) { return prescriptionService.getDecline(id); }

    @GetMapping("/api/v1/prescription-decline-notifications")
    public Map<String, Object> declineNotifications(@AuthenticationPrincipal AuthenticatedPrincipal staff) {
        return Map.of("items", prescriptionService.declineNotifications(staff.userId()));
    }

    @PostMapping("/api/v1/prescriptions/safety-check")
    public ResponseEntity<Map<String, Object>> safetyCheck(@Valid @RequestBody SafetyCheckRequest request) {
        var items = request.items().stream().map(i -> new PrescriptionService.PrescriptionItemInput(i.drugName(), i.dosage(), i.quantity())).toList();
        return ResponseEntity.ok(Map.of("alerts", prescriptionService.check(request.patientId(), items)));
    }

    @GetMapping("/api/v1/prescriptions/manual-verification")
    public ResponseEntity<Map<String, Object>> manualVerificationQueue() {
        List<ManualVerificationCaseResponse> items = prescriptionService.listManualVerificationCases().stream()
                .map(c -> new ManualVerificationCaseResponse(c.getId(), c.getPrescriptionId(), c.getPatientId(),
                        c.getReason(), c.getCreatedAt()))
                .toList();
        return ResponseEntity.ok(Map.of("items", items));
    }

    // Enriched with the patient's name/MPI — same reasoning as
    // QueueService.QueueEntryView: this is a staff-facing view where
    // knowing WHO a prescription belongs to at a glance matters, not just
    // its raw patientId.
    private PrescriptionResponse toResponse(Prescription p) {
        List<PrescriptionItemResponse> items = prescriptionService.getItems(p.getId()).stream()
                .map(i -> new PrescriptionItemResponse(i.getDrugName(), i.getDosage(), i.getQuantity())).toList();
        Patient patient = patientService.get(p.getPatientId());
        PrescriptionQuerySummary latestQuery = prescriptionQueries
                .findFirstByPrescriptionIdAndStatusOrderByRaisedAtDesc(p.getId(), PrescriptionQueryStatus.RESPONDED)
                .map(q -> new PrescriptionQuerySummary(q.getId(), q.getStatus(), q.getReason(), q.getGuidelineWarning(),
                        q.getPrescriberResponse(), q.getRespondedAt()))
                .orElse(null);
        return new PrescriptionResponse(p.getId(), p.getSerialNumber(), p.getVisitId(), p.getPatientId(),
                patient.getFirstName() + " " + patient.getLastName(), patient.getMpiNumber(), p.getFacilityId(),
                p.getPrescriberId(), p.getStatus(), items, p.getCreatedAt(), latestQuery);
    }

    public record CreatePrescriptionRequest(@NotNull UUID visitId, @NotEmpty List<@Valid ItemRequest> items, String overrideReason) {
    }

    public record DispenseRequest(String overrideReason, LocalDate coverageUntil) { }
    public record DeclineRequest(@NotNull DeclineReasonCode reasonCode, String reasonDetail) { }
    public record SafetyCheckRequest(@NotNull UUID patientId, @NotEmpty List<@Valid ItemRequest> items) { }

    public record ItemRequest(@NotBlank String drugName, @NotBlank String dosage, @Positive int quantity) {
    }

    public record PrescriptionItemResponse(String drugName, String dosage, int quantity) {
    }

    public record ManualVerificationCaseResponse(UUID id, UUID prescriptionId, UUID patientId, String reason,
                                                  Instant createdAt) {
    }

    public record PrescriptionResponse(UUID id, String serialNumber, UUID visitId, UUID patientId,
                                        String patientName, String patientMpi, UUID facilityId, UUID prescriberId,
                                        PrescriptionStatus status, List<PrescriptionItemResponse> items,
                                        Instant createdAt, PrescriptionQuerySummary latestQuery) {
    }

    /** Included on queue/detail reads so pharmacy can see the response without opening a separate inbox. */
    public record PrescriptionQuerySummary(UUID id, PrescriptionQueryStatus status, String reason, String guidelineWarning,
                                           String prescriberResponse, Instant respondedAt) { }
}
