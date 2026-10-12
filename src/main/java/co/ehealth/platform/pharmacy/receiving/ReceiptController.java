package co.ehealth.platform.pharmacy.receiving;

import co.ehealth.platform.core.security.AuthenticatedPrincipal;
import co.ehealth.platform.core.tenant.ModuleCode;
import co.ehealth.platform.identity.PermissionLevel;
import co.ehealth.platform.identity.PermissionService;
import co.ehealth.platform.identity.User;
import co.ehealth.platform.identity.UserRepository;
import co.ehealth.platform.pharmacy.receiving.ReceiptQueryService.ReceiptDetailView;
import co.ehealth.platform.pharmacy.receiving.ReceiptQueryService.ReceiptLineView;
import co.ehealth.platform.pharmacy.receiving.ReceiptQueryService.ReceiptSummaryView;
import co.ehealth.platform.pharmacy.stock.ExpiryPrecision;
import co.ehealth.platform.pharmacy.stock.PharmacyReceipt;
import co.ehealth.platform.pharmacy.stock.PharmacyReceiptLine;
import co.ehealth.platform.pharmacy.stock.ReceiptFlagReason;
import co.ehealth.platform.pharmacy.stock.ReceiptStatus;
import org.springframework.data.domain.Page;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;

// Contract section 3 (B2): receipt history and reversal. Posting a receipt
// stays in PharmacyReceiptController (POST /receipts).
@RestController
@RequestMapping("/api/v1/pharmacy")
public class ReceiptController {

    private final ReceiptQueryService queryService;
    private final ReceiptReversalService reversalService;
    private final PermissionService permissionService;
    private final UserRepository userRepository;

    public ReceiptController(ReceiptQueryService queryService, ReceiptReversalService reversalService,
                             PermissionService permissionService, UserRepository userRepository) {
        this.queryService = queryService;
        this.reversalService = reversalService;
        this.permissionService = permissionService;
        this.userRepository = userRepository;
    }

    @GetMapping("/receipts")
    public ResponseEntity<Map<String, Object>> list(
            @RequestParam UUID facilityId, @RequestParam(required = false) UUID supplierId,
            @RequestParam(required = false) String q,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "50") int size) {
        permissionService.requireAccess(ModuleCode.PHRM, PermissionLevel.VIEW);
        return ResponseEntity.ok(pageOf(queryService.list(facilityId, supplierId, q, from, to, page, size)));
    }

    // Powers the expandable row on the suppliers page: the supplier's latest receipts.
    @GetMapping("/suppliers/{supplierId}/receipts")
    public ResponseEntity<Map<String, Object>> listForSupplier(@PathVariable UUID supplierId,
                                                               @RequestParam(defaultValue = "10") int size) {
        permissionService.requireAccess(ModuleCode.PHRM, PermissionLevel.VIEW);
        return ResponseEntity.ok(pageOf(queryService.list(null, supplierId, null, null, null, 0, size)));
    }

    @GetMapping("/receipts/{id}")
    public ResponseEntity<ReceiptDetailResponse> get(@PathVariable UUID id) {
        permissionService.requireAccess(ModuleCode.PHRM, PermissionLevel.VIEW);
        return ResponseEntity.ok(ReceiptDetailResponse.from(queryService.get(id)));
    }

    @PostMapping("/receipts/{id}/reverse")
    public ResponseEntity<ReceiptDetailResponse> reverse(@PathVariable UUID id,
                                                         @RequestBody(required = false) ReverseReceiptRequest request,
                                                         @AuthenticationPrincipal AuthenticatedPrincipal principal) {
        permissionService.requireAccess(ModuleCode.PHRM, PermissionLevel.MANAGE);
        User actor = userRepository.findById(principal.userId()).orElseThrow();
        String reason = request == null ? null : request.reason();
        reversalService.reverse(id, reason, actor.getId(), actor.getFirstName() + " " + actor.getLastName());
        return ResponseEntity.ok(ReceiptDetailResponse.from(queryService.get(id)));
    }

    private Map<String, Object> pageOf(Page<ReceiptSummaryView> result) {
        return Map.of("items", result.getContent().stream().map(ReceiptSummaryResponse::from).toList(),
                "page", result.getNumber(), "size", result.getSize(), "totalItems", result.getTotalElements(),
                "hasMore", result.hasNext());
    }

    public record ReverseReceiptRequest(String reason) {
    }

    public record ReceiptSummaryResponse(UUID id, String receiptNumber, UUID supplierId, String supplierName,
                                         String invoiceNumber, Instant receivedAt, String receivedByName,
                                         int lineCount, long totalUnits, ReceiptStatus status, boolean usedStock) {
        static ReceiptSummaryResponse from(ReceiptSummaryView view) {
            PharmacyReceipt receipt = view.receipt();
            return new ReceiptSummaryResponse(receipt.getId(), receipt.getReceiptNumber(), receipt.getSupplierId(),
                    view.supplierName(), receipt.getInvoiceNumber(), receipt.getCreatedAt(),
                    receipt.getCreatedByName(), view.lineCount(), view.totalUnits(), receipt.getStatus(),
                    view.usedStock());
        }
    }

    // The summary fields flattened, plus the lines and the reversal audit.
    public record ReceiptDetailResponse(UUID id, String receiptNumber, UUID supplierId, String supplierName,
                                        String invoiceNumber, Instant receivedAt, String receivedByName,
                                        int lineCount, long totalUnits, ReceiptStatus status, boolean usedStock,
                                        Instant reversedAt, String reversedByName,
                                        List<ReceiptLineResponse> lines) {
        static ReceiptDetailResponse from(ReceiptDetailView view) {
            ReceiptSummaryResponse summary = ReceiptSummaryResponse.from(view.summary());
            PharmacyReceipt receipt = view.summary().receipt();
            return new ReceiptDetailResponse(summary.id(), summary.receiptNumber(), summary.supplierId(),
                    summary.supplierName(), summary.invoiceNumber(), summary.receivedAt(),
                    summary.receivedByName(), summary.lineCount(), summary.totalUnits(), summary.status(),
                    summary.usedStock(), receipt.getReversedAt(), receipt.getReversedByName(),
                    view.lines().stream().map(ReceiptLineResponse::from).toList());
        }
    }

    public record LineFlagResponse(ReceiptFlagReason reason, String note, int acceptedQuantity) {
    }

    public record ReceiptLineResponse(UUID id, UUID productId, String productCode, String productName,
                                      String lotNumber, LocalDate expiryDate, ExpiryPrecision expiryPrecision,
                                      int quantity, int rejectedQuantity, ReceiptLineState state,
                                      LineFlagResponse flag, BigDecimal temperatureC, Boolean coldBoxIntact) {
        static ReceiptLineResponse from(ReceiptLineView view) {
            PharmacyReceiptLine line = view.line();
            LineFlagResponse flag = line.getFlagReason() == null ? null
                    : new LineFlagResponse(line.getFlagReason(), line.getFlagNote(), line.getBaseQuantity());
            return new ReceiptLineResponse(line.getId(), line.getProductId(), view.product().getCode(),
                    view.product().getDisplayName(), line.getLotNumber(), line.getExpiryDate(),
                    line.getExpiryPrecision(), line.getBaseQuantity(), line.getRejectedQuantity(), view.state(),
                    flag, line.getTemperatureC(), line.getColdBoxIntact());
        }
    }
}
