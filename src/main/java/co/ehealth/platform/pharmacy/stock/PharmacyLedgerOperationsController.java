package co.ehealth.platform.pharmacy.stock;

import co.ehealth.platform.core.security.AuthenticatedPrincipal;
import co.ehealth.platform.core.tenant.ModuleCode;
import co.ehealth.platform.identity.PermissionLevel;
import co.ehealth.platform.identity.PermissionService;
import co.ehealth.platform.identity.User;
import co.ehealth.platform.identity.UserRepository;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

// The write side of the ledger beyond receiving: manual adjustments and
// reversals. Both change stock, so both need PHRM:MANAGE (same documented
// VIEW/MANAGE simplification as the other pharmacy controllers).
@RestController
@RequestMapping("/api/v1/pharmacy")
public class PharmacyLedgerOperationsController {

    private static final String IDEMPOTENCY_HEADER = "Idempotency-Key";

    private final PharmacyAdjustmentService adjustmentService;
    private final StockReversalService reversalService;
    private final PermissionService permissionService;
    private final UserRepository userRepository;

    public PharmacyLedgerOperationsController(PharmacyAdjustmentService adjustmentService,
                                               StockReversalService reversalService,
                                               PermissionService permissionService, UserRepository userRepository) {
        this.adjustmentService = adjustmentService;
        this.reversalService = reversalService;
        this.permissionService = permissionService;
        this.userRepository = userRepository;
    }

    @PostMapping("/adjustments")
    public ResponseEntity<AdjustmentResponse> adjust(
            @Valid @RequestBody AdjustmentRequest request,
            @RequestHeader(value = IDEMPOTENCY_HEADER, required = false) String idempotencyKeyHeader,
            @AuthenticationPrincipal AuthenticatedPrincipal principal) {
        permissionService.requireAccess(ModuleCode.PHRM, PermissionLevel.MANAGE);
        // A request without a key can't be deduplicated against a retry of
        // itself, same fallback as PharmacyReceiptController.
        String idempotencyKey = (idempotencyKeyHeader == null || idempotencyKeyHeader.isBlank())
                ? UUID.randomUUID().toString() : idempotencyKeyHeader;
        PharmacyAdjustmentService.AdjustmentResult result = adjustmentService.adjust(request.toCommand(),
                idempotencyKey, currentActor(principal));
        return ResponseEntity.status(HttpStatus.CREATED).body(AdjustmentResponse.from(result));
    }

    @PostMapping("/transactions/{id}/reverse")
    public ResponseEntity<ReversalResponse> reverse(@PathVariable UUID id,
                                                     @Valid @RequestBody ReverseRequest request,
                                                     @AuthenticationPrincipal AuthenticatedPrincipal principal) {
        permissionService.requireAccess(ModuleCode.PHRM, PermissionLevel.MANAGE);
        PharmacyStockTransaction reversal = reversalService.reverse(id, request.reason(), request.note(),
                currentActor(principal));
        return ResponseEntity.status(HttpStatus.CREATED).body(ReversalResponse.from(reversal));
    }

    private StockActor currentActor(AuthenticatedPrincipal principal) {
        User user = userRepository.findById(principal.userId()).orElseThrow();
        return new StockActor(user.getId(), user.getFirstName() + " " + user.getLastName());
    }

    public record AdjustmentRequest(@NotNull UUID facilityId, @NotNull UUID productId, UUID batchId,
                                    List<String> serialNumbers, @NotNull AdjustmentMode mode, @Positive int quantity,
                                    @NotNull AdjustmentReason reason, String note) {
        PharmacyAdjustmentService.AdjustmentCommand toCommand() {
            return new PharmacyAdjustmentService.AdjustmentCommand(facilityId, productId, batchId, serialNumbers,
                    mode, quantity, reason, note);
        }
    }

    public record AdjustmentResponse(UUID transactionId, String type, UUID productId, UUID batchId,
                                     long quantityDelta, long lotBalanceAfter, Instant createdAt) {
        static AdjustmentResponse from(PharmacyAdjustmentService.AdjustmentResult result) {
            return new AdjustmentResponse(result.transactionId(), result.type().name(), result.productId(),
                    result.batchId(), result.quantityDelta(), result.lotBalanceAfter(), result.createdAt());
        }
    }

    public record ReverseRequest(@NotNull ReversalReason reason, String note) {
    }

    public record ReversalResponse(UUID transactionId, UUID reversedTransactionId, Instant createdAt) {
        static ReversalResponse from(PharmacyStockTransaction reversal) {
            return new ReversalResponse(reversal.getId(), reversal.getReversalOfTransactionId(),
                    reversal.getCreatedAt());
        }
    }
}
