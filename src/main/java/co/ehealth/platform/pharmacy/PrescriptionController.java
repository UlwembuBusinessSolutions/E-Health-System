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

    public PrescriptionController(PrescriptionService prescriptionService, PatientService patientService) {
        this.prescriptionService = prescriptionService;
        this.patientService = patientService;
    }

    @PostMapping("/api/v1/prescriptions")
    public ResponseEntity<PrescriptionResponse> create(@Valid @RequestBody CreatePrescriptionRequest request,
                                                         @AuthenticationPrincipal AuthenticatedPrincipal staff) {
        var items = request.items().stream()
                .map(i -> new PrescriptionService.PrescriptionItemInput(i.drugName(), i.dosage(), i.quantity()))
                .toList();
        var command = new PrescriptionService.CreatePrescriptionCommand(request.visitId(), items);
        Prescription prescription = prescriptionService.create(command, staff.userId());
        return ResponseEntity.status(HttpStatus.CREATED).body(toResponse(prescription));
    }

    @GetMapping("/api/v1/prescriptions/queue")
    public ResponseEntity<Map<String, Object>> queue(@RequestParam UUID facilityId) {
        List<PrescriptionResponse> items = prescriptionService.listQueue(facilityId).stream()
                .map(this::toResponse).toList();
        return ResponseEntity.ok(Map.of("items", items));
    }

    @GetMapping("/api/v1/prescriptions/{id}")
    public ResponseEntity<PrescriptionResponse> get(@PathVariable UUID id) {
        return ResponseEntity.ok(toResponse(prescriptionService.get(id)));
    }

    @PostMapping("/api/v1/prescriptions/{id}/dispense")
    public ResponseEntity<Void> dispense(@PathVariable UUID id,
                                          @AuthenticationPrincipal AuthenticatedPrincipal staff) {
        prescriptionService.dispense(id, staff.userId());
        return ResponseEntity.noContent().build();
    }

    // Enriched with the patient's name/MPI — same reasoning as
    // QueueService.QueueEntryView: this is a staff-facing view where
    // knowing WHO a prescription belongs to at a glance matters, not just
    // its raw patientId.
    private PrescriptionResponse toResponse(Prescription p) {
        List<PrescriptionItemResponse> items = prescriptionService.getItems(p.getId()).stream()
                .map(i -> new PrescriptionItemResponse(i.getDrugName(), i.getDosage(), i.getQuantity())).toList();
        Patient patient = patientService.get(p.getPatientId());
        return new PrescriptionResponse(p.getId(), p.getSerialNumber(), p.getVisitId(), p.getPatientId(),
                patient.getFirstName() + " " + patient.getLastName(), patient.getMpiNumber(), p.getFacilityId(),
                p.getPrescriberId(), p.getStatus(), items, p.getCreatedAt());
    }

    public record CreatePrescriptionRequest(@NotNull UUID visitId, @NotEmpty List<@Valid ItemRequest> items) {
    }

    public record ItemRequest(@NotBlank String drugName, @NotBlank String dosage, @Positive int quantity) {
    }

    public record PrescriptionItemResponse(String drugName, String dosage, int quantity) {
    }

    public record PrescriptionResponse(UUID id, String serialNumber, UUID visitId, UUID patientId,
                                        String patientName, String patientMpi, UUID facilityId, UUID prescriberId,
                                        PrescriptionStatus status, List<PrescriptionItemResponse> items,
                                        Instant createdAt) {
    }
}
