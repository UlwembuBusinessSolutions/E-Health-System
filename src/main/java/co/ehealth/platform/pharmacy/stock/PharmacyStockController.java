package co.ehealth.platform.pharmacy.stock;

import co.ehealth.platform.core.common.CsvExport;
import co.ehealth.platform.core.tenant.ModuleCode;
import co.ehealth.platform.identity.PermissionLevel;
import co.ehealth.platform.identity.PermissionService;
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

// Plan section 15's GET /products/{id}/batches plus the two Phase-1 CSV
// exports section 13 calls for (stock balances, batch/expiry). The stock
// list and dashboard live in PharmacyStockWorklistController, the ledger in
// PharmacyLedgerController. PHRM:VIEW covers all of it — same
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
        Map<UUID, List<String>> serialsByBatchId = stockQueryService.inStockSerialsByBatch(id);
        List<BatchRow> items = stockQueryService.listBatches(id).stream()
                .filter(batch -> quantityByBatchId.getOrDefault(batch.getId(), 0L) > 0)
                .map(batch -> BatchRow.from(batch, quantityByBatchId.get(batch.getId()),
                        serialsByBatchId.getOrDefault(batch.getId(), List.of())))
                .toList();
        return ResponseEntity.ok(Map.of("items", items));
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
                CsvExport.cell(StockStatus.classify(b.available(), b.reorderThreshold()).label()))).toList();
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

    private ResponseEntity<byte[]> csvResponse(List<String> header, List<List<String>> rows, String reportName) {
        byte[] csv = CsvExport.toCsv(header, rows).getBytes(StandardCharsets.UTF_8);
        String filename = "pharmacy-" + reportName + "-" + DateTimeFormatter.ofPattern("yyyyMMdd-HHmmss")
                .withZone(ZoneOffset.UTC).format(clock.instant()) + ".csv";
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment().filename(filename).build().toString())
                .contentType(MediaType.parseMediaType("text/csv;charset=UTF-8"))
                .body(csv);
    }

    public record BatchRow(UUID batchId, String lotNumber, String manufacturer, String expiryDate,
                            ExpiryPrecision expiryPrecision, long quantity, List<String> serialNumbers) {
        static BatchRow from(PharmacyBatch batch, long quantity, List<String> serialNumbers) {
            return new BatchRow(batch.getId(), batch.getLotNumber(), batch.getManufacturer(),
                    batch.getExpiryDate() == null ? null : batch.getExpiryDate().toString(),
                    batch.getExpiryPrecision(), quantity, serialNumbers);
        }
    }
}
