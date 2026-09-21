package co.ehealth.platform.pharmacy.stock;

import co.ehealth.platform.core.security.AuthenticatedPrincipal;
import co.ehealth.platform.core.tenant.ModuleCode;
import co.ehealth.platform.identity.PermissionLevel;
import co.ehealth.platform.identity.PermissionService;
import co.ehealth.platform.identity.User;
import co.ehealth.platform.identity.UserRepository;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

// Plan section 15: "POST /receipts ... Idempotent posting." STOCK_RECEIVE
// is proposed as its own capability (plan section 10); reused as
// PHRM:MANAGE here, same documented VIEW/MANAGE simplification as the
// other Phase 1 controllers.
@RestController
@RequestMapping("/api/v1/pharmacy/receipts")
public class PharmacyReceiptController {

    // Idempotency-Key is a standard HTTP header name for exactly this
    // purpose (used by Stripe and others) — a real header, not a body
    // field, so a client library or proxy that already knows the
    // convention needs no special-casing for this endpoint.
    private static final String IDEMPOTENCY_HEADER = "Idempotency-Key";

    private final PharmacyReceiptService receiptService;
    private final PermissionService permissionService;
    private final UserRepository userRepository;

    public PharmacyReceiptController(PharmacyReceiptService receiptService, PermissionService permissionService,
                                      UserRepository userRepository) {
        this.receiptService = receiptService;
        this.permissionService = permissionService;
        this.userRepository = userRepository;
    }

    @PostMapping
    public ResponseEntity<ReceiptResponse> receive(
            @Valid @RequestBody ReceiveStockRequest request,
            @RequestHeader(value = IDEMPOTENCY_HEADER, required = false) String idempotencyKeyHeader,
            @AuthenticationPrincipal AuthenticatedPrincipal principal) {
        permissionService.requireAccess(ModuleCode.PHRM, PermissionLevel.MANAGE);
        // Falls back to a per-request-generated key only as a safety net —
        // every real client is expected to send one so a genuine network
        // retry (not a fresh submission) reuses it; a fabricated key here
        // means a request that arrives with none simply can't be
        // deduplicated against a retry of itself, same as if idempotency
        // didn't exist for that one call.
        String idempotencyKey = (idempotencyKeyHeader == null || idempotencyKeyHeader.isBlank())
                ? UUID.randomUUID().toString() : idempotencyKeyHeader;

        User actor = userRepository.findById(principal.userId()).orElseThrow();
        var command = new PharmacyReceiptService.ReceiveStockCommand(request.facilityId(), request.sourceReference(),
                request.supplierName(), request.lines().stream().map(ReceiveLineRequest::toCommand).toList());
        PharmacyReceipt receipt = receiptService.receive(command, idempotencyKey, actor.getId(),
                actor.getFirstName() + " " + actor.getLastName());
        return ResponseEntity.status(HttpStatus.CREATED).body(ReceiptResponse.from(receipt));
    }

    public record ReceiveLineRequest(@NotNull UUID productId, String manufacturer, String lotNumber,
                                      LocalDate expiryDate, ExpiryPrecision expiryPrecision, Integer packs,
                                      Integer packSizeUsed, Integer baseQuantity) {
        PharmacyReceiptService.ReceiveLineCommand toCommand() {
            return new PharmacyReceiptService.ReceiveLineCommand(productId, manufacturer,
                    lotNumber == null || lotNumber.isBlank() ? "N/A" : lotNumber, expiryDate, expiryPrecision, packs,
                    packSizeUsed, baseQuantity);
        }
    }

    public record ReceiveStockRequest(@NotNull UUID facilityId, String sourceReference, String supplierName,
                                       @NotEmpty List<@Valid ReceiveLineRequest> lines) {
    }

    public record ReceiptResponse(UUID id, UUID facilityId, String sourceReference, String supplierName,
                                   String createdByName, Instant createdAt) {
        static ReceiptResponse from(PharmacyReceipt r) {
            return new ReceiptResponse(r.getId(), r.getFacilityId(), r.getSourceReference(), r.getSupplierName(),
                    r.getCreatedByName(), r.getCreatedAt());
        }
    }
}
