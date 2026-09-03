package co.ehealth.platform.pharmacy;

import co.ehealth.platform.core.security.AuthenticatedPrincipal;
import co.ehealth.platform.identity.User;
import co.ehealth.platform.identity.UserRepository;
import co.ehealth.platform.patient.Patient;
import co.ehealth.platform.patient.PatientService;
import co.ehealth.platform.visit.QueueToken;
import co.ehealth.platform.visit.Visit;
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
    private final StockService stockService;

    public PrescriptionController(PrescriptionService prescriptionService, PatientService patientService,
                                   UserRepository userRepository, StockService stockService) {
        this.prescriptionService = prescriptionService;
        this.patientService = patientService;
        this.userRepository = userRepository;
        this.stockService = stockService;
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
                                          @Valid @RequestBody DispenseRequest request,
                                          @AuthenticationPrincipal AuthenticatedPrincipal staff) {
        var scans = request.scans().stream()
                .map(scan -> new PrescriptionService.StockScan(scan.barcode(), scan.quantity())).toList();
        prescriptionService.dispense(id, scans, staff.userId());
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/api/v1/pharmacy/stock")
    public ResponseEntity<StockBatchResponse> receiveStock(@Valid @RequestBody ReceiveStockRequest request,
                                                             @AuthenticationPrincipal AuthenticatedPrincipal staff) {
        StockBatch batch = stockService.receive(new StockService.ReceiveStockCommand(request.facilityId(),
                request.drugName(), request.batchNumber(), request.barcode(), request.expiryDate(), request.quantity()),
                staff.userId());
        return ResponseEntity.status(HttpStatus.CREATED).body(StockBatchResponse.from(batch));
    }

    @GetMapping("/api/v1/pharmacy/stock/expiry-warnings")
    public ResponseEntity<List<StockBatchResponse>> expiryWarnings(@RequestParam UUID facilityId) {
        return ResponseEntity.ok(stockService.expiryWarnings(facilityId).stream().map(StockBatchResponse::from).toList());
    }

    @PostMapping("/api/v1/pharmacy/stock/{id}/write-off")
    public ResponseEntity<StockBatchResponse> writeOff(@PathVariable UUID id,
                                                        @Valid @RequestBody WriteOffRequest request,
                                                        @AuthenticationPrincipal AuthenticatedPrincipal staff) {
        return ResponseEntity.ok(StockBatchResponse.from(stockService.writeOff(id, request.quantity(), request.reason(),
                staff.userId())));
    }

    // Enriched with the patient's name/MPI — same reasoning as
    // QueueService.QueueEntryView: this is a staff-facing view where
    // knowing WHO a prescription belongs to at a glance matters, not just
    // its raw patientId.
    private PrescriptionResponse toResponse(Prescription p) {
        List<PrescriptionItemResponse> items = prescriptionService.getItems(p.getId()).stream()
                .map(i -> new PrescriptionItemResponse(i.getDrugName(), i.getDosage(), i.getQuantity())).toList();
        Patient patient = patientService.get(p.getPatientId());
        Visit visit = prescriptionService.getVisit(p.getVisitId());
        QueueToken token = prescriptionService.getQueueToken(p.getVisitId());
        User prescriber = userRepository.findById(p.getPrescriberId()).orElse(null);
        return new PrescriptionResponse(p.getId(), p.getSerialNumber(), p.getVisitId(), p.getPatientId(),
                patient.getFirstName() + " " + patient.getLastName(), patient.getMpiNumber(), p.getFacilityId(),
                p.getPrescriberId(), prescriber == null ? "Unknown prescriber"
                    : prescriber.getFirstName() + " " + prescriber.getLastName(),
                visit.getVisitType(), visit.getServiceStream(), token == null ? null : token.getPriority(),
                token == null ? null : token.getTokenNumber(), p.getStatus(), items, p.getCreatedAt());
    }

    public record CreatePrescriptionRequest(@NotNull UUID visitId, @NotEmpty List<@Valid ItemRequest> items) {
    }

    public record DispenseRequest(@NotEmpty List<@Valid StockScanRequest> scans) {
    }

    public record StockScanRequest(@NotBlank String barcode, @Positive int quantity) {
    }

    public record ReceiveStockRequest(@NotNull UUID facilityId, @NotBlank String drugName,
                                      @NotBlank String batchNumber, @NotBlank String barcode,
                                      @NotNull java.time.LocalDate expiryDate, @Positive int quantity) {
    }

    public record WriteOffRequest(@Positive int quantity, @NotBlank String reason) {
    }

    public record ItemRequest(@NotBlank String drugName, @NotBlank String dosage, @Positive int quantity) {
    }

    public record PrescriptionItemResponse(String drugName, String dosage, int quantity) {
    }

    public record PrescriptionResponse(UUID id, String serialNumber, UUID visitId, UUID patientId,
                                        String patientName, String patientMpi, UUID facilityId, UUID prescriberId,
                                        String prescriberName, co.ehealth.platform.visit.VisitType visitType,
                                        co.ehealth.platform.visit.ServiceStream serviceStream,
                                        co.ehealth.platform.visit.TokenPriority priority, Integer tokenNumber,
                                        PrescriptionStatus status, List<PrescriptionItemResponse> items,
                                        Instant createdAt) {
    }
}
