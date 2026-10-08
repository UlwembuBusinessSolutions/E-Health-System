package co.ehealth.platform.pharmacy.dispensing;

import co.ehealth.platform.core.security.AuthenticatedPrincipal;
import co.ehealth.platform.core.tenant.ModuleCode;
import co.ehealth.platform.identity.PermissionLevel;
import co.ehealth.platform.identity.PermissionService;
import co.ehealth.platform.pharmacy.PrescriptionService;
import co.ehealth.platform.pharmacy.dispensing.DispenseReturnService.ReturnCommand;
import co.ehealth.platform.pharmacy.dispensing.DispensingResponses.CollectResponse;
import co.ehealth.platform.pharmacy.dispensing.DispensingResponses.ReturnResponse;
import co.ehealth.platform.pharmacy.dispensing.PatientDispensingHistoryService.DispensingHistoryRow;
import co.ehealth.platform.pharmacy.dispensing.PrescriptionSearchService.SearchRow;
import co.ehealth.platform.pharmacy.dispensing.StockArrivalService.StockArrival;
import co.ehealth.platform.pharmacy.dispensing.SubstitutionService.SubstitutionView;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;
import java.util.UUID;

// Stock-backed dispensing endpoints beyond the per-item dispense and queue
// that PrescriptionController keeps. Controllers only translate HTTP to the
// services; every rule lives in the services.
@RestController
public class DispensingController {

    private final PrescriptionService prescriptionService;
    private final PrescriptionViewAssembler viewAssembler;
    private final PrescriptionCollectionService collectionService;
    private final DispenseReturnService returnService;
    private final SubstitutionService substitutionService;
    private final PrescriptionSearchService searchService;
    private final StockArrivalService arrivalService;
    private final PatientDispensingHistoryService historyService;
    private final CollectionDetailsService detailsService;
    private final PermissionService permissionService;

    public DispensingController(PrescriptionService prescriptionService, PrescriptionViewAssembler viewAssembler,
                                 PrescriptionCollectionService collectionService,
                                 DispenseReturnService returnService, SubstitutionService substitutionService,
                                 PrescriptionSearchService searchService, StockArrivalService arrivalService,
                                 PatientDispensingHistoryService historyService,
                                 CollectionDetailsService detailsService, PermissionService permissionService) {
        this.prescriptionService = prescriptionService;
        this.viewAssembler = viewAssembler;
        this.collectionService = collectionService;
        this.returnService = returnService;
        this.substitutionService = substitutionService;
        this.searchService = searchService;
        this.arrivalService = arrivalService;
        this.historyService = historyService;
        this.detailsService = detailsService;
        this.permissionService = permissionService;
    }

    // Confirms or overrides the stock product behind a line. Returns the
    // whole prescription so the screen can redraw the item with its lots.
    @PutMapping("/api/v1/prescriptions/{id}/items/{itemId}/product")
    public ResponseEntity<PrescriptionResponse> confirmProduct(@PathVariable UUID id, @PathVariable UUID itemId,
                                                                @Valid @RequestBody ConfirmProductRequest request,
                                                                @AuthenticationPrincipal AuthenticatedPrincipal staff) {
        var prescription = prescriptionService.confirmProduct(id, itemId, request.productId(), staff.userId());
        return ResponseEntity.ok(viewAssembler.assemble(prescription));
    }

    @PostMapping("/api/v1/prescriptions/{id}/collect")
    public ResponseEntity<CollectResponse> collect(@PathVariable UUID id,
                                                    @Valid @RequestBody CollectRequest request,
                                                    @AuthenticationPrincipal AuthenticatedPrincipal staff) {
        var outcome = collectionService.collect(id, request.toCommand(), staff.userId());
        return ResponseEntity.ok(CollectResponse.of(outcome));
    }

    // Uploaded before the collect call; the returned reference is sent back
    // as proofRef.
    @PostMapping("/api/v1/prescriptions/{id}/collection-proof")
    public ResponseEntity<ProofUploadResponse> uploadCollectionProof(@PathVariable UUID id,
                                                                      @RequestPart("file") MultipartFile file,
                                                                      @AuthenticationPrincipal AuthenticatedPrincipal staff) {
        String proofRef = detailsService.storeProof(id, file, staff.userId());
        return ResponseEntity.status(HttpStatus.CREATED).body(new ProofUploadResponse(proofRef));
    }

    // Opening these details is audit-logged by the service: they include a
    // third party's full ID number.
    @GetMapping("/api/v1/prescriptions/{id}/collection")
    public ResponseEntity<CollectionDetailsResponse> collectionDetails(@PathVariable UUID id,
                                                                        @AuthenticationPrincipal AuthenticatedPrincipal staff) {
        permissionService.requireAccess(ModuleCode.PHRM, PermissionLevel.VIEW);
        return ResponseEntity.ok(detailsService.view(id, staff.userId()));
    }

    @GetMapping("/api/v1/prescriptions/{id}/collection-proof/{proofRef}")
    public ResponseEntity<byte[]> collectionProof(@PathVariable UUID id, @PathVariable String proofRef) {
        permissionService.requireAccess(ModuleCode.PHRM, PermissionLevel.VIEW);
        CollectionProofStorage.StoredProof proof = detailsService.proof(id, proofRef);
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(proof.contentType()))
                .header(HttpHeaders.CONTENT_DISPOSITION, "inline")
                .body(proof.content());
    }

    @PostMapping("/api/v1/prescriptions/{id}/items/{itemId}/return")
    public ResponseEntity<ReturnResponse> returnItem(@PathVariable UUID id, @PathVariable UUID itemId,
                                                      @Valid @RequestBody ReturnRequest request,
                                                      @AuthenticationPrincipal AuthenticatedPrincipal staff) {
        var outcome = returnService.recordReturn(id, itemId,
                new ReturnCommand(request.quantity(), request.condition(), request.reason()), staff.userId());
        return ResponseEntity.ok(ReturnResponse.of(outcome));
    }

    @PostMapping("/api/v1/prescriptions/{id}/items/{itemId}/substitution")
    public ResponseEntity<SubstitutionView> requestSubstitution(@PathVariable UUID id, @PathVariable UUID itemId,
                                                                 @Valid @RequestBody SubstitutionRequest request,
                                                                 @AuthenticationPrincipal AuthenticatedPrincipal staff) {
        var view = substitutionService.request(id, itemId, request.substituteProductId(), request.note(),
                staff.userId());
        return ResponseEntity.status(HttpStatus.CREATED).body(view);
    }

    @PatchMapping("/api/v1/prescriptions/{id}/items/{itemId}/substitution")
    public ResponseEntity<SubstitutionView> decideSubstitution(@PathVariable UUID id, @PathVariable UUID itemId,
                                                                @Valid @RequestBody SubstitutionDecisionRequest request,
                                                                @AuthenticationPrincipal AuthenticatedPrincipal staff) {
        return ResponseEntity.ok(substitutionService.decide(id, itemId, request.status(), request.note(),
                staff.userId()));
    }

    @GetMapping("/api/v1/prescriptions/search")
    public ResponseEntity<Map<String, List<SearchRow>>> search(@RequestParam(defaultValue = "") String q,
                                                                @RequestParam(defaultValue = "ALL") SearchState state,
                                                                @RequestParam(required = false) UUID facilityId) {
        return ResponseEntity.ok(Map.of("items", searchService.search(q, state, facilityId)));
    }

    @GetMapping("/api/v1/pharmacy/stock-arrivals")
    public ResponseEntity<Map<String, List<StockArrival>>> stockArrivals(@RequestParam UUID facilityId) {
        return ResponseEntity.ok(Map.of("items", arrivalService.listArrivals(facilityId)));
    }

    @GetMapping("/api/v1/patients/{patientId}/dispensing")
    public ResponseEntity<Map<String, List<DispensingHistoryRow>>> patientDispensing(
            @PathVariable UUID patientId) {
        return ResponseEntity.ok(Map.of("items", historyService.historyFor(patientId)));
    }

    public record ConfirmProductRequest(@NotNull UUID productId) {
    }

    public record ProofUploadResponse(String proofRef) {
    }

    // items omitted/empty = every item still pending. collector is required
    // (and validated) only when collectedByPatient is false. signature is a
    // PNG data URL (its size cap is CollectionRules'); proofRef is what the
    // collection-proof upload returned. witnessStaffId and witnessPassword
    // are only needed when a Schedule 6 item is handed over.
    public record CollectRequest(List<UUID> items, boolean collectedByPatient, @Valid CollectorRequest collector,
                                 boolean idVerified, String signature, @Size(max = 100) String proofRef,
                                 @Size(max = 500) String notes, UUID witnessStaffId, String witnessPassword) {

        CollectCommand toCommand() {
            CollectCommand.Collector mapped = collector == null ? null : new CollectCommand.Collector(
                    collector.name(), collector.idType(), collector.idNumber(), collector.relationship(),
                    collector.phone(), collector.authorisationType());
            return new CollectCommand(items, collectedByPatient, mapped, idVerified, signature, proofRef, notes,
                    new WitnessCredentials(witnessStaffId, witnessPassword));
        }
    }

    public record CollectorRequest(@Size(max = 200) String name, @Size(max = 30) String idType,
                                   @Size(max = 50) String idNumber, @Size(max = 100) String relationship,
                                   @Size(max = 30) String phone, AuthorisationType authorisationType) {
    }

    public record ReturnRequest(@Positive int quantity, @NotNull ReturnCondition condition,
                                @NotBlank @Size(max = 500) String reason) {
    }

    public record SubstitutionRequest(@NotNull UUID substituteProductId, @Size(max = 500) String note) {
    }

    public record SubstitutionDecisionRequest(@NotNull SubstitutionStatus status, @Size(max = 500) String note) {
    }
}
