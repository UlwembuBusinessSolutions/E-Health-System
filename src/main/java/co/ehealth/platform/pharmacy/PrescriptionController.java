package co.ehealth.platform.pharmacy;

import co.ehealth.platform.core.security.AuthenticatedPrincipal;
import co.ehealth.platform.identity.User;
import co.ehealth.platform.identity.UserRepository;
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
    private final UserRepository userRepository;

    public PrescriptionController(PrescriptionService prescriptionService, PatientService patientService,
                                   UserRepository userRepository) {
        this.prescriptionService = prescriptionService;
        this.patientService = patientService;
        this.userRepository = userRepository;
    }

    @PostMapping("/api/v1/prescriptions")
    public ResponseEntity<PrescriptionResponse> create(@Valid @RequestBody CreatePrescriptionRequest request,
                                                         @AuthenticationPrincipal AuthenticatedPrincipal staff) {
        var items = request.items().stream()
                .map(i -> new PrescriptionService.PrescriptionItemInput(i.drugName(), i.dosage(), i.quantity()))
                .toList();
        var command =
                new PrescriptionService.CreatePrescriptionCommand(request.visitId(), items, request.consultationId());
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

    // The pharmacy "look up a prescription" utility — by the human-facing
    // serial number (RX-0000005), not a UUID, so a prescription that
    // dropped off the active queue (every item out of stock, nothing left
    // pending) can still be found and finished once stock is back.
    @GetMapping("/api/v1/prescriptions/by-serial/{serialNumber}")
    public ResponseEntity<PrescriptionResponse> getBySerial(@PathVariable String serialNumber) {
        return ResponseEntity.ok(toResponse(prescriptionService.getBySerialNumber(serialNumber)));
    }

    // The patient-level Medication tab (PatientDetailPage) — every
    // prescription this patient has ever had, every status alike, so
    // "what's this patient on, who prescribed it, and was it actually
    // taken" is answerable from the patient record itself, not just from
    // whichever facility's dispensing queue happens to still show it
    // (listQueue() only ever returns PENDING/PARTIALLY_DISPENSED).
    @GetMapping("/api/v1/patients/{patientId}/prescriptions")
    public ResponseEntity<Map<String, Object>> patientPrescriptions(@PathVariable UUID patientId) {
        List<PrescriptionResponse> items = prescriptionService.getPatientPrescriptions(patientId).stream()
                .map(this::toResponse).toList();
        return ResponseEntity.ok(Map.of("items", items));
    }

    // "Mark all as collected" — dispenses every item still PENDING on this
    // prescription; an item already OUT_OF_STOCK is left untouched.
    @PostMapping("/api/v1/prescriptions/{id}/dispense")
    public ResponseEntity<Void> dispenseAllPending(@PathVariable UUID id,
                                                    @AuthenticationPrincipal AuthenticatedPrincipal staff) {
        prescriptionService.dispenseAllPending(id, staff.userId());
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/api/v1/prescriptions/{id}/items/{itemId}/dispense")
    public ResponseEntity<Void> dispenseItem(@PathVariable UUID id, @PathVariable UUID itemId,
                                              @AuthenticationPrincipal AuthenticatedPrincipal staff) {
        prescriptionService.dispenseItem(id, itemId, staff.userId());
        return ResponseEntity.noContent().build();
    }

    // Never removes the item — just records that it went unfilled and why
    // (note is optional). Callable again on an already-out-of-stock item to
    // update the note (PrescriptionService.markItemOutOfStock()'s own
    // why-note).
    @PostMapping("/api/v1/prescriptions/{id}/items/{itemId}/out-of-stock")
    public ResponseEntity<Void> markItemOutOfStock(@PathVariable UUID id, @PathVariable UUID itemId,
                                                    @Valid @RequestBody MarkOutOfStockRequest request,
                                                    @AuthenticationPrincipal AuthenticatedPrincipal staff) {
        prescriptionService.markItemOutOfStock(id, itemId, staff.userId(), request.note());
        return ResponseEntity.noContent().build();
    }

    // "Something else" — a pharmacy query about this prescription that
    // isn't a stock or dispensing action. Sends a real email to the
    // prescriber (PrescriptionService.sendPrescriberMessage()) and returns
    // the saved thread entry so the caller can show it immediately.
    @PostMapping("/api/v1/prescriptions/{id}/message-prescriber")
    public ResponseEntity<PrescriberMessageResponse> messagePrescriber(@PathVariable UUID id,
                                                                        @Valid @RequestBody MessagePrescriberRequest request,
                                                                        @AuthenticationPrincipal AuthenticatedPrincipal staff) {
        PrescriberMessage saved = prescriptionService.sendPrescriberMessage(id, staff.userId(), request.message());
        return ResponseEntity.status(HttpStatus.CREATED).body(toMessageResponse(saved));
    }

    @GetMapping("/api/v1/prescriptions/{id}/messages")
    public ResponseEntity<Map<String, Object>> messages(@PathVariable UUID id) {
        List<PrescriberMessageResponse> items =
                prescriptionService.getPrescriberMessages(id).stream().map(this::toMessageResponse).toList();
        return ResponseEntity.ok(Map.of("items", items));
    }

    private PrescriberMessageResponse toMessageResponse(PrescriberMessage m) {
        User sender = userRepository.findById(m.getSenderUserId()).orElse(null);
        String senderName = sender == null ? null : sender.getFirstName() + " " + sender.getLastName();
        return new PrescriberMessageResponse(m.getId(), senderName, m.getMessage(), m.getSentAt());
    }

    // Enriched with the patient's name/MPI, the prescriber's name/
    // registration number/phone/email (the queue's own Call/Message
    // affordances), and each item's own dispensed/out-of-stock detail —
    // same reasoning as QueueService.QueueEntryView: this is a
    // staff-facing (and, via the print page, patient-facing) view where
    // knowing WHO did what at a glance matters, not just raw ids.
    // Registration number prefers HPCSA, falling back to SANC —
    // PrescriptionService.create()'s own canPrescribe() gate already
    // accepts either, so a prescriber may hold only one.
    private PrescriptionResponse toResponse(Prescription p) {
        List<PrescriptionItemResponse> items =
                prescriptionService.getItems(p.getId()).stream().map(this::toItemResponse).toList();
        Patient patient = patientService.get(p.getPatientId());
        User prescriber = userRepository.findById(p.getPrescriberId()).orElse(null);
        String prescriberName = prescriber == null ? null
                : prescriber.getFirstName() + " " + prescriber.getLastName();
        String prescriberRegistrationNumber = prescriber == null ? null
                : prescriber.getHpcsaNumber() != null ? prescriber.getHpcsaNumber() : prescriber.getSancNumber();
        String prescriberPhone = prescriber == null ? null : prescriber.getContactNumber();
        String prescriberEmail = prescriber == null ? null : prescriber.getEmail();

        return new PrescriptionResponse(p.getId(), p.getSerialNumber(), p.getVisitId(), p.getPatientId(),
                patient.getFirstName() + " " + patient.getLastName(), patient.getMpiNumber(), p.getFacilityId(),
                p.getPrescriberId(), prescriberName, prescriberRegistrationNumber, prescriberPhone, prescriberEmail,
                p.getConsultationId(), p.getStatus(), items, p.getCreatedAt());
    }

    private PrescriptionItemResponse toItemResponse(PrescriptionItem i) {
        var dispensingRecord = prescriptionService.getDispensingRecord(i.getId());
        String dispensedByName = dispensingRecord
                .flatMap(d -> userRepository.findById(d.getDispensedByUserId()))
                .map(u -> u.getFirstName() + " " + u.getLastName())
                .orElse(null);
        Instant dispensedAt = dispensingRecord.map(DispensingRecord::getDispensedAt).orElse(null);

        var outOfStockRecord = prescriptionService.getOutOfStockRecord(i.getId());
        String markedOutOfStockByName = outOfStockRecord
                .flatMap(r -> userRepository.findById(r.getMarkedByUserId()))
                .map(u -> u.getFirstName() + " " + u.getLastName())
                .orElse(null);
        Instant markedOutOfStockAt = outOfStockRecord.map(PrescriptionOutOfStockRecord::getMarkedAt).orElse(null);
        String outOfStockNote = outOfStockRecord.map(PrescriptionOutOfStockRecord::getNote).orElse(null);

        return new PrescriptionItemResponse(i.getId(), i.getDrugName(), i.getDosage(), i.getQuantity(),
                i.getStatus(), dispensedByName, dispensedAt, markedOutOfStockByName, markedOutOfStockAt,
                outOfStockNote);
    }

    // consultationId is optional — omitted (or null) keeps this request
    // behaving exactly as it did before that field existed.
    public record CreatePrescriptionRequest(@NotNull UUID visitId, @NotEmpty List<@Valid ItemRequest> items,
                                             UUID consultationId) {
    }

    public record ItemRequest(@NotBlank String drugName, @NotBlank String dosage, @Positive int quantity) {
    }

    // note is deliberately not @NotBlank — an empty body ({}) is a valid
    // "mark out of stock, no further detail" call.
    public record MarkOutOfStockRequest(String note) {
    }

    public record MessagePrescriberRequest(@NotBlank String message) {
    }

    public record PrescriberMessageResponse(UUID id, String senderName, String message, Instant sentAt) {
    }

    public record PrescriptionItemResponse(UUID id, String drugName, String dosage, int quantity,
                                            PrescriptionStatus status, String dispensedByName, Instant dispensedAt,
                                            String markedOutOfStockByName, Instant markedOutOfStockAt,
                                            String outOfStockNote) {
    }

    public record PrescriptionResponse(UUID id, String serialNumber, UUID visitId, UUID patientId,
                                        String patientName, String patientMpi, UUID facilityId, UUID prescriberId,
                                        String prescriberName, String prescriberRegistrationNumber,
                                        String prescriberPhone, String prescriberEmail, UUID consultationId,
                                        PrescriptionStatus status, List<PrescriptionItemResponse> items,
                                        Instant createdAt) {
    }
}
