package co.ehealth.platform.pharmacy.csvimport;

import co.ehealth.platform.core.security.AuthenticatedPrincipal;
import co.ehealth.platform.core.tenant.ModuleCode;
import co.ehealth.platform.identity.PermissionLevel;
import co.ehealth.platform.identity.PermissionService;
import co.ehealth.platform.identity.User;
import co.ehealth.platform.identity.UserRepository;
import co.ehealth.platform.pharmacy.csvimport.CsvImportService.ImportResult;
import co.ehealth.platform.pharmacy.csvimport.ImportRowChecker.CheckedRow;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;

// Import products and stock from a spreadsheet. Every call needs PHRM:MANAGE:
// the check is only meaningful to someone allowed to import.
@RestController
@RequestMapping("/api/v1/pharmacy/import")
public class CsvImportController {

    static final int MAX_ROWS = 2000;

    private final CsvImportService importService;
    private final PermissionService permissionService;
    private final UserRepository userRepository;

    public CsvImportController(CsvImportService importService, PermissionService permissionService,
                               UserRepository userRepository) {
        this.importService = importService;
        this.permissionService = permissionService;
        this.userRepository = userRepository;
    }

    @PostMapping("/check")
    public ResponseEntity<CheckResponse> check(@Valid @RequestBody CheckRequest request) {
        permissionService.requireAccess(ModuleCode.PHRM, PermissionLevel.MANAGE);
        List<CheckedRow> checked = importService.check(request.supplierId(), request.invoiceNumber(), request.rows());
        return ResponseEntity.ok(CheckResponse.from(checked));
    }

    @PostMapping
    public ResponseEntity<ImportResult> run(@Valid @RequestBody RunRequest request,
                                            @AuthenticationPrincipal AuthenticatedPrincipal principal) {
        permissionService.requireAccess(ModuleCode.PHRM, PermissionLevel.MANAGE);
        User actor = userRepository.findById(principal.userId()).orElseThrow();
        ImportResult result = importService.run(request.facilityId(), request.supplierId(),
                request.invoiceNumber(), request.fileName(), request.rows(), actor.getId(), fullName(actor));
        return ResponseEntity.status(HttpStatus.CREATED).body(result);
    }

    @PostMapping("/{batchId}/undo")
    public ResponseEntity<BatchResponse> undo(@PathVariable UUID batchId,
                                              @AuthenticationPrincipal AuthenticatedPrincipal principal) {
        permissionService.requireAccess(ModuleCode.PHRM, PermissionLevel.MANAGE);
        User actor = userRepository.findById(principal.userId()).orElseThrow();
        ImportBatch batch = importService.undo(batchId, actor.getId(), fullName(actor));
        return ResponseEntity.ok(batchResponse(batch));
    }

    @GetMapping("/recent")
    public ResponseEntity<Map<String, Object>> recent(@RequestParam UUID facilityId) {
        permissionService.requireAccess(ModuleCode.PHRM, PermissionLevel.MANAGE);
        List<BatchResponse> items = importService.recent(facilityId).stream().map(this::batchResponse).toList();
        return ResponseEntity.ok(Map.of("items", items));
    }

    private BatchResponse batchResponse(ImportBatch batch) {
        return new BatchResponse(batch.getId(), batch.getFileName(), batch.getStatus(), batch.getRowsImported(),
                batch.getProductsCreated(), batch.getReceiptsCreated(), batch.getUnitsReceived(),
                batch.getCreatedByName(), batch.getCreatedAt(), importService.isUndoable(batch),
                importService.undoableUntil(batch), batch.getUndoneAt());
    }

    private static String fullName(User user) {
        return user.getFirstName() + " " + user.getLastName();
    }

    public record CheckRequest(UUID supplierId, String invoiceNumber,
                               @NotEmpty @Size(max = MAX_ROWS) List<ImportRow> rows) {
    }

    public record RunRequest(@NotNull UUID facilityId, UUID supplierId, String invoiceNumber, String fileName,
                             @NotEmpty @Size(max = MAX_ROWS) List<ImportRow> rows) {
    }

    public record RowResult(int rowNumber, ImportRowStatus status, ImportProblem problem, String hint,
                            String suggestion, String warning, String productCode, String productName, String lot,
                            LocalDate expiry, int quantity, String supplierName, String invoice,
                            boolean scheduled) {
        static RowResult from(CheckedRow row) {
            String code = row.product() != null ? row.product().getCode()
                    : row.newProduct() != null ? row.newProduct().code() : null;
            String name = row.product() != null ? row.product().getDisplayName()
                    : row.newProduct() != null ? row.newProduct().name() : null;
            return new RowResult(row.rowNumber(), row.status(), row.problem(), row.hint(), row.suggestion(),
                    row.warning(), code, name, row.lot(), row.expiry(), row.quantity(),
                    row.supplier() == null ? null : row.supplier().getName(), row.invoice(), row.scheduled());
        }
    }

    public record Summary(int total, int ready, int problems, int newProducts, int restockRows, long units,
                          int scheduledRows) {
        static Summary from(List<CheckedRow> rows) {
            List<CheckedRow> ready = rows.stream().filter(row -> !row.isProblem()).toList();
            int newProducts = (int) ready.stream().filter(row -> row.newProduct() != null)
                    .map(row -> ImportRowChecker.productKey(row.newProduct().code())).distinct().count();
            return new Summary(rows.size(), ready.size(), rows.size() - ready.size(), newProducts,
                    (int) ready.stream().filter(row -> row.status() == ImportRowStatus.RESTOCK).count(),
                    ready.stream().mapToLong(CheckedRow::quantity).sum(),
                    (int) ready.stream().filter(CheckedRow::scheduled).count());
        }
    }

    public record CheckResponse(List<RowResult> rows, Summary summary, boolean allOk) {
        static CheckResponse from(List<CheckedRow> checked) {
            Summary summary = Summary.from(checked);
            return new CheckResponse(checked.stream().map(RowResult::from).toList(), summary,
                    summary.problems() == 0);
        }
    }

    public record BatchResponse(UUID id, String fileName, ImportBatchStatus status, int rowsImported,
                                int productsCreated, int receiptsCreated, long unitsReceived, String createdByName,
                                Instant createdAt, boolean canUndo, Instant undoableUntil, Instant undoneAt) {
    }
}
