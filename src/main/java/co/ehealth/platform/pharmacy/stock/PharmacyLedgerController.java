package co.ehealth.platform.pharmacy.stock;

import co.ehealth.platform.core.tenant.ModuleCode;
import co.ehealth.platform.identity.PermissionLevel;
import co.ehealth.platform.identity.PermissionService;
import org.springframework.data.domain.Page;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

// Plan section 15's GET /ledger plus the per-product history with a running
// balance. PHRM:VIEW covers both — same VIEW/MANAGE simplification as the
// other pharmacy controllers.
@RestController
@RequestMapping("/api/v1/pharmacy")
public class PharmacyLedgerController {

    private final PharmacyLedgerQueryService ledgerQueryService;
    private final PermissionService permissionService;

    public PharmacyLedgerController(PharmacyLedgerQueryService ledgerQueryService,
                                    PermissionService permissionService) {
        this.ledgerQueryService = ledgerQueryService;
        this.permissionService = permissionService;
    }

    @GetMapping("/ledger")
    public PagedResponse<LedgerEntryResponse> listLedger(
            @RequestParam UUID facilityId, @RequestParam(required = false) UUID productId,
            @RequestParam(required = false) StockTransactionType type,
            @RequestParam(required = false) UUID supplierId, @RequestParam(required = false) UUID patientId,
            @RequestParam(required = false) String q,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "50") int size) {
        permissionService.requireAccess(ModuleCode.PHRM, PermissionLevel.VIEW);
        var filter = new PharmacyLedgerQueryService.LedgerFilter(facilityId, productId, type, supplierId, patientId,
                q, from, to);
        Page<LedgerRow> rows = ledgerQueryService.listLedger(filter, page, size);
        return PagedResponse.of(rows, LedgerEntryResponse::from);
    }

    @GetMapping("/products/{id}/history")
    public PagedResponse<LedgerEntryResponse> productHistory(
            @PathVariable UUID id, @RequestParam UUID facilityId, @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size) {
        permissionService.requireAccess(ModuleCode.PHRM, PermissionLevel.VIEW);
        Page<LedgerRow> rows = ledgerQueryService.listProductHistory(facilityId, id, page, size);
        return PagedResponse.of(rows, LedgerEntryResponse::from);
    }

    // `reason` is the free-text note, `reasonCode` the picked reason;
    // balanceAfter is the lot's balance, runningBalance (history only) the
    // product's total across lots.
    public record LedgerEntryResponse(UUID id, long seq, UUID transactionId, String type, UUID productId,
                                      String productName, String productCode, UUID batchId, String lotNumber,
                                      String expiryDate, long quantityDelta, long balanceAfter, Long runningBalance,
                                      String actorName, String reason, String reasonCode, String sourceReference,
                                      UUID supplierId, String supplierName, UUID patientId, String patientName,
                                      String prescriptionSerial, UUID reversalOfTransactionId,
                                      UUID reversedByTransactionId, Instant createdAt) {
        static LedgerEntryResponse from(LedgerRow row) {
            PharmacyStockTransaction transaction = row.transaction();
            PharmacyBatch batch = row.batch();
            return new LedgerEntryResponse(row.entry().getId(), row.entry().getSeq(), transaction.getId(),
                    transaction.getType().name(), row.product().getId(), row.product().getDisplayName(),
                    row.product().getCode(), batch.getId(), batch.getLotNumber(),
                    batch.getExpiryDate() == null ? null : batch.getExpiryDate().toString(),
                    row.entry().getQuantityDelta(), row.entry().getBalanceAfter(), row.runningBalance(),
                    transaction.getActorName(), transaction.getReason(), transaction.getReasonCode(),
                    transaction.getSourceReference(), transaction.getSupplierId(), row.supplierName(),
                    transaction.getPatientId(), row.patientName(), transaction.getPrescriptionSerial(),
                    transaction.getReversalOfTransactionId(), row.reversedByTransactionId(),
                    row.entry().getCreatedAt());
        }
    }
}
