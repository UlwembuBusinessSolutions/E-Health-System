package co.ehealth.platform.pharmacy.stock;

import co.ehealth.platform.core.common.CsvExport;
import co.ehealth.platform.core.tenant.ModuleCode;
import co.ehealth.platform.identity.PermissionLevel;
import co.ehealth.platform.identity.PermissionService;
import org.springframework.data.domain.Page;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;
import java.util.UUID;

// Plan section 15's read endpoints: GET /stock, GET /products/{id}/batches,
// GET /ledger, plus the two Phase-1 CSV exports section 13 calls for
// (stock balances, batch/expiry). PHRM:VIEW covers all of it — same
// documented VIEW/MANAGE simplification as PharmacyProductController.
@RestController
@RequestMapping("/api/v1/pharmacy")
public class PharmacyStockController {

    private final PharmacyStockQueryService stockQueryService;
    private final PermissionService permissionService;
    private final Clock clock;

    public PharmacyStockController(PharmacyStockQueryService stockQueryService, PermissionService permissionService,
                                    Clock clock) {
        this.stockQueryService = stockQueryService;
        this.permissionService = permissionService;
        this.clock = clock;
    }

    @GetMapping("/stock")
    public ResponseEntity<Map<String, Object>> listStock(@RequestParam UUID facilityId) {
        permissionService.requireAccess(ModuleCode.PHRM, PermissionLevel.VIEW);
        List<StockRow> items = stockQueryService.listFacilityBalances(facilityId).stream()
                .map(StockRow::from).toList();
        return ResponseEntity.ok(Map.of("items", items));
    }

    // Ordered earliest-expiry-first (FEFO, plan section 6) — iterating the
    // already-sorted batch list and looking up each one's account,
    // NOT the reverse (account list order is arbitrary; a batch with a
    // null expiry naturally sorts last via findByProductIdOrderByExpiryDateAsc's
    // NULLS LAST default).
    @GetMapping("/products/{id}/batches")
    public ResponseEntity<Map<String, Object>> listBatches(@PathVariable UUID id) {
        permissionService.requireAccess(ModuleCode.PHRM, PermissionLevel.VIEW);
        Map<UUID, Long> quantityByBatchId = stockQueryService.listAccountsForProduct(id).stream()
                .collect(java.util.stream.Collectors.groupingBy(PharmacyStockAccount::getBatchId,
                        java.util.stream.Collectors.summingLong(PharmacyStockAccount::getQuantity)));
        List<BatchRow> items = stockQueryService.listBatches(id).stream()
                .filter(batch -> quantityByBatchId.getOrDefault(batch.getId(), 0L) > 0)
                .map(batch -> BatchRow.from(batch, quantityByBatchId.get(batch.getId())))
                .toList();
        return ResponseEntity.ok(Map.of("items", items));
    }

    @GetMapping("/ledger")
    public ResponseEntity<Map<String, Object>> listLedger(
            @RequestParam UUID facilityId, @RequestParam(required = false) UUID productId,
            @RequestParam(required = false, defaultValue = "0") int page,
            @RequestParam(required = false, defaultValue = "50") int size) {
        permissionService.requireAccess(ModuleCode.PHRM, PermissionLevel.VIEW);
        Page<PharmacyStockQueryService.LedgerRow> result = stockQueryService.listLedger(facilityId, productId, page,
                size);
        return ResponseEntity.ok(Map.of(
                "items", result.getContent().stream().map(LedgerEntryResponse::from).toList(),
                "page", result.getNumber(), "size", result.getSize(), "totalItems", result.getTotalElements(),
                "hasMore", result.hasNext()));
    }

    // Plan section 13, export #1: "Stock balances: physical/available/
    // blocked and base units." Phase 1 has only the AVAILABLE bucket, so
    // physical == available here; the column still exists so Phase 2's
    // HELD bucket is an additive value in this same export, not a new one.
    @GetMapping("/exports/stock-balances")
    public ResponseEntity<byte[]> exportStockBalances(@RequestParam UUID facilityId) {
        permissionService.requireAccess(ModuleCode.PHRM, PermissionLevel.VIEW);
        List<PharmacyStockQueryService.ProductStockBalance> balances = stockQueryService
                .listFacilityBalances(facilityId);
        List<String> header = List.of("Code", "Product", "Base unit", "Physical", "Available", "Reorder threshold",
                "Status");
        List<List<String>> rows = balances.stream().map(b -> List.of(
                CsvExport.cell(b.product().getCode()),
                CsvExport.cell(b.product().getDisplayName()),
                CsvExport.cell(b.product().getBaseUnit().name()),
                CsvExport.cell(String.valueOf(b.available())),
                CsvExport.cell(String.valueOf(b.available())),
                CsvExport.cell(b.reorderThreshold() == null ? "" : String.valueOf(b.reorderThreshold())),
                CsvExport.cell(stockStatus(b)))).toList();
        return csvResponse(header, rows, "stock-balances");
    }

    // Export #2: "Batch/expiry report: location, state, lot, date/precision
    // and quantity."
    @GetMapping("/exports/batch-expiry")
    public ResponseEntity<byte[]> exportBatchExpiry(@RequestParam UUID facilityId) {
        permissionService.requireAccess(ModuleCode.PHRM, PermissionLevel.VIEW);
        List<PharmacyStockQueryService.ProductStockBalance> balances = stockQueryService
                .listFacilityBalances(facilityId);
        List<String> header = List.of("Product", "Lot number", "Manufacturer", "Expiry date", "Precision", "Quantity");
        List<List<String>> rows = new java.util.ArrayList<>();
        for (var balance : balances) {
            for (PharmacyStockAccount account : stockQueryService.listAccountsForProduct(balance.product().getId())) {
                if (account.getQuantity() <= 0) continue;
                PharmacyBatch batch = stockQueryService.listBatches(balance.product().getId()).stream()
                        .filter(b -> b.getId().equals(account.getBatchId())).findFirst().orElse(null);
                if (batch == null) continue;
                rows.add(List.of(
                        CsvExport.cell(balance.product().getDisplayName()),
                        CsvExport.cell(batch.getLotNumber()),
                        CsvExport.cell(batch.getManufacturer()),
                        CsvExport.cell(batch.getExpiryDate() == null ? "" : batch.getExpiryDate().toString()),
                        CsvExport.cell(batch.getExpiryPrecision() == null ? "" : batch.getExpiryPrecision().name()),
                        CsvExport.cell(String.valueOf(account.getQuantity()))));
            }
        }
        return csvResponse(header, rows, "batch-expiry");
    }

    private static String stockStatus(PharmacyStockQueryService.ProductStockBalance balance) {
        if (balance.available() <= 0) return "Out of stock";
        if (balance.reorderThreshold() != null && balance.available() <= balance.reorderThreshold()) {
            return "Low stock";
        }
        return "In stock";
    }

    private ResponseEntity<byte[]> csvResponse(List<String> header, List<List<String>> rows, String reportName) {
        byte[] csv = CsvExport.toCsv(header, rows).getBytes(StandardCharsets.UTF_8);
        String filename = "pharmacy-" + reportName + "-" + DateTimeFormatter.ofPattern("yyyyMMdd-HHmmss")
                .withZone(ZoneOffset.UTC).format(clock.instant()) + ".csv";
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment().filename(filename).build().toString())
                .contentType(MediaType.parseMediaType("text/csv;charset=UTF-8"))
                .body(csv);
    }

    public record StockRow(UUID productId, String code, String displayName, StockBaseUnit baseUnit, long available,
                            Integer reorderThreshold, String status) {
        static StockRow from(PharmacyStockQueryService.ProductStockBalance b) {
            return new StockRow(b.product().getId(), b.product().getCode(), b.product().getDisplayName(),
                    b.product().getBaseUnit(), b.available(), b.reorderThreshold(), stockStatus(b));
        }
    }

    public record BatchRow(UUID batchId, String lotNumber, String manufacturer, String expiryDate,
                            ExpiryPrecision expiryPrecision, long quantity) {
        static BatchRow from(PharmacyBatch batch, long quantity) {
            return new BatchRow(batch.getId(), batch.getLotNumber(), batch.getManufacturer(),
                    batch.getExpiryDate() == null ? null : batch.getExpiryDate().toString(),
                    batch.getExpiryPrecision(), quantity);
        }
    }

    public record LedgerEntryResponse(UUID id, long seq, String type, String productName, String productCode,
                                       String lotNumber, long quantityDelta, long balanceAfter, String actorName,
                                       String reason, String sourceReference, java.time.Instant createdAt) {
        static LedgerEntryResponse from(PharmacyStockQueryService.LedgerRow row) {
            return new LedgerEntryResponse(row.entry().getId(), row.entry().getSeq(), row.transaction().getType().name(),
                    row.product().getDisplayName(), row.product().getCode(),
                    row.batch() != null ? row.batch().getLotNumber() : null, row.entry().getQuantityDelta(),
                    row.entry().getBalanceAfter(), row.transaction().getActorName(), row.transaction().getReason(),
                    row.transaction().getSourceReference(), row.entry().getCreatedAt());
        }
    }
}
