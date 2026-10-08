package co.ehealth.platform.pharmacy;

import co.ehealth.platform.core.security.AuthenticatedPrincipal;
import co.ehealth.platform.identity.User;
import co.ehealth.platform.identity.UserRepository;
import co.ehealth.platform.pharmacy.dispensing.CollectCommand;
import co.ehealth.platform.pharmacy.dispensing.DispenseAllocationService.DispenseRequest;
import co.ehealth.platform.pharmacy.dispensing.DispensingResponses.CollectResponse;
import co.ehealth.platform.pharmacy.dispensing.DispensingResponses.DispenseItemResponse;
import co.ehealth.platform.pharmacy.dispensing.PrescriptionCollectionService;
import co.ehealth.platform.pharmacy.dispensing.PrescriptionResponse;
import co.ehealth.platform.pharmacy.dispensing.PrescriptionViewAssembler;
import co.ehealth.platform.pharmacy.dispensing.WitnessCredentials;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
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
// DispensingGuard (PHRM permission plus StaffService.getLicenseStatus()),
// not a role check. Same .anyRequest().authenticated() fallthrough as
// Patient/Visit/Queue. Collection, returns, substitution, search and the
// other stock-backed endpoints live in DispensingController.
@RestController
public class PrescriptionController {

    private final PrescriptionService prescriptionService;
    private final PrescriptionCollectionService collectionService;
    private final PrescriptionViewAssembler viewAssembler;
    private final UserRepository userRepository;

    public PrescriptionController(PrescriptionService prescriptionService,
                                   PrescriptionCollectionService collectionService,
                                   PrescriptionViewAssembler viewAssembler, UserRepository userRepository) {
        this.prescriptionService = prescriptionService;
        this.collectionService = collectionService;
        this.viewAssembler = viewAssembler;
        this.userRepository = userRepository;
    }

    @PostMapping("/api/v1/prescriptions")
    public ResponseEntity<PrescriptionResponse> create(@Valid @RequestBody CreatePrescriptionRequest request,
                                                         @AuthenticationPrincipal AuthenticatedPrincipal staff) {
        List<ItemRequest> requested = request.items() == null ? List.of() : request.items();
        var items = requested.stream()
                .map(i -> new PrescriptionService.PrescriptionItemInput(i.drugName(), i.dosage(), i.quantity(),
                        i.productId()))
                .toList();
        List<PrescriptionService.PrescriptionPurchaseItemInput> purchaseItems = request.purchaseItems() == null
                ? List.of()
                : request.purchaseItems().stream().map(i -> new PrescriptionService.PrescriptionPurchaseItemInput(
                        i.drugName(), i.dosage(), i.quantity(), i.productId(), i.note())).toList();
        var command = new PrescriptionService.CreatePrescriptionCommand(request.visitId(), items,
                request.consultationId(), purchaseItems);
        Prescription prescription = prescriptionService.create(command, staff.userId());
        return ResponseEntity.status(HttpStatus.CREATED).body(viewAssembler.assemble(prescription));
    }

    // Each item carries its mapped product, remaining quantity, suggested
    // lot and stock status (PrescriptionViewAssembler), built for the whole
    // queue in a handful of queries.
    @GetMapping("/api/v1/prescriptions/queue")
    public ResponseEntity<Map<String, Object>> queue(@RequestParam UUID facilityId) {
        List<PrescriptionResponse> items = viewAssembler.assemble(prescriptionService.listQueue(facilityId));
        return ResponseEntity.ok(Map.of("items", items));
    }

    @GetMapping("/api/v1/prescriptions/{id}")
    public ResponseEntity<PrescriptionResponse> get(@PathVariable UUID id) {
        return ResponseEntity.ok(viewAssembler.assemble(prescriptionService.get(id)));
    }

    // The pharmacy "look up a prescription" utility — by the human-facing
    // serial number (RX-0000005), not a UUID, so a prescription that
    // dropped off the active queue (every item out of stock, nothing left
    // pending) can still be found and finished once stock is back.
    @GetMapping("/api/v1/prescriptions/by-serial/{serialNumber}")
    public ResponseEntity<PrescriptionResponse> getBySerial(@PathVariable String serialNumber) {
        return ResponseEntity.ok(viewAssembler.assemble(prescriptionService.getBySerialNumber(serialNumber)));
    }

    // The patient-level Medication tab (PatientDetailPage) — every
    // prescription this patient has ever had, every status alike, so
    // "what's this patient on, who prescribed it, and was it actually
    // taken" is answerable from the patient record itself, not just from
    // whichever facility's dispensing queue happens to still show it
    // (listQueue() only ever returns PENDING/PARTIALLY_DISPENSED).
    @GetMapping("/api/v1/patients/{patientId}/prescriptions")
    public ResponseEntity<Map<String, Object>> patientPrescriptions(@PathVariable UUID patientId) {
        List<PrescriptionResponse> items = viewAssembler.assemble(prescriptionService.getPatientPrescriptions(patientId));
        return ResponseEntity.ok(Map.of("items", items));
    }

    // The original "Mark all as collected" button — kept working by handing
    // over every in-stock pending item to the patient themselves, exactly as
    // POST .../collect would. Items without stock come back as skipped
    // instead of being faked as dispensed.
    @PostMapping("/api/v1/prescriptions/{id}/dispense")
    public ResponseEntity<CollectResponse> dispenseAllPending(@PathVariable UUID id,
                                                               @AuthenticationPrincipal AuthenticatedPrincipal staff) {
        var outcome = collectionService.collect(id, CollectCommand.patientTakesAllPending(), staff.userId());
        return ResponseEntity.ok(CollectResponse.of(outcome));
    }

    // The body is optional: no body (or {}) dispenses everything remaining,
    // first-expiring lot first, as the original button did.
    @PostMapping("/api/v1/prescriptions/{id}/items/{itemId}/dispense")
    public ResponseEntity<DispenseItemResponse> dispenseItem(@PathVariable UUID id, @PathVariable UUID itemId,
                                                              @Valid @RequestBody(required = false)
                                                              DispenseItemRequest request,
                                                              @AuthenticationPrincipal AuthenticatedPrincipal staff) {
        DispenseRequest dispenseRequest = request == null ? DispenseRequest.remaining()
                : new DispenseRequest(request.quantity(), request.batchId(),
                        new WitnessCredentials(request.witnessStaffId(), request.witnessPassword()));
        var outcome = prescriptionService.dispenseItem(id, itemId, dispenseRequest, staff.userId());
        return ResponseEntity.ok(DispenseItemResponse.of(outcome));
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

    // consultationId is optional — omitted (or null) keeps this request
    // behaving exactly as it did before that field existed.
    public record CreatePrescriptionRequest(@NotNull UUID visitId, List<@Valid ItemRequest> items,
                                             UUID consultationId,
                                             List<@Valid PurchaseItemRequest> purchaseItems) {
    }

    // productId is set when the prescriber chose the medicine from the pharmacy's
    // stock list; the quantity is then checked against the shelf.
    public record ItemRequest(@NotBlank String drugName, @NotBlank String dosage, @Positive int quantity,
                              UUID productId) {
    }

    // A medicine the patient buys instead of receiving it from the pharmacy.
    public record PurchaseItemRequest(@NotBlank String drugName, @NotBlank String dosage, @Positive int quantity,
                                      UUID productId, @Size(max = 300) String note) {
    }

    // Both fields optional: quantity defaults to everything remaining
    // (partial dispensing means a smaller number), batchId to
    // first-expiring-first. The witness fields are only needed for a Schedule 6
    // medicine.
    public record DispenseItemRequest(@Positive Integer quantity, UUID batchId, UUID witnessStaffId,
                                      String witnessPassword) {
    }

    // note is deliberately not @NotBlank — an empty body ({}) is a valid
    // "mark out of stock, no further detail" call.
    public record MarkOutOfStockRequest(String note) {
    }

    public record MessagePrescriberRequest(@NotBlank String message) {
    }

    public record PrescriberMessageResponse(UUID id, String senderName, String message, Instant sentAt) {
    }
}
