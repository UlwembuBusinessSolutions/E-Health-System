package co.ehealth.platform.pharmacy.csvimport;

import co.ehealth.platform.core.audit.AuditDetails;
import co.ehealth.platform.core.audit.AuditLogService;
import co.ehealth.platform.facility.FacilityNotFoundException;
import co.ehealth.platform.facility.FacilityRepository;
import co.ehealth.platform.pharmacy.csvimport.ImportRowChecker.CheckedRow;
import co.ehealth.platform.pharmacy.csvimport.ImportRowChecker.Context;
import co.ehealth.platform.pharmacy.receiving.ReceiptReversalService;
import co.ehealth.platform.pharmacy.stock.ExpiryPrecision;
import co.ehealth.platform.pharmacy.stock.PharmacyBatchRepository;
import co.ehealth.platform.pharmacy.stock.PharmacyProduct;
import co.ehealth.platform.pharmacy.stock.PharmacyProductRepository;
import co.ehealth.platform.pharmacy.stock.PharmacyProductService;
import co.ehealth.platform.pharmacy.stock.PharmacyReceipt;
import co.ehealth.platform.pharmacy.stock.PharmacyReceiptRepository;
import co.ehealth.platform.pharmacy.stock.PharmacyReceiptService;
import co.ehealth.platform.pharmacy.stock.PharmacyReceiptService.ReceiveLineCommand;
import co.ehealth.platform.pharmacy.stock.PharmacyReceiptService.ReceiveStockCommand;
import co.ehealth.platform.pharmacy.stock.PharmacyValidationException;
import co.ehealth.platform.pharmacy.stock.ProductHandling;
import co.ehealth.platform.pharmacy.supplier.PharmacySupplier;
import co.ehealth.platform.pharmacy.supplier.PharmacySupplierRepository;
import co.ehealth.platform.pharmacy.supplier.SupplierNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

// Imports products and stock from a spreadsheet. Every row is checked first
// (check), then a clean sheet is applied in ONE transaction (run): the missing
// products are created and each supplier/invoice group becomes a normal
// receipt, so the ledger, the scheduled register and the audit trail all see
// an import exactly as they see hand-keyed receiving. What an import created
// is remembered so the whole thing can be undone (undo) while it is fresh.
@Service
public class CsvImportService {

    static final Duration UNDO_WINDOW = Duration.ofHours(24);
    private static final int MAX_SOURCE_REFERENCE = 100;

    private final PharmacyProductRepository productRepository;
    private final PharmacyProductService productService;
    private final PharmacySupplierRepository supplierRepository;
    private final PharmacyBatchRepository batchRepository;
    private final PharmacyReceiptRepository receiptRepository;
    private final PharmacyReceiptService receiptService;
    private final ReceiptReversalService reversalService;
    private final ImportRowChecker rowChecker;
    private final ImportBatchRepository batchLogRepository;
    private final ImportBatchItemRepository itemRepository;
    private final FacilityRepository facilityRepository;
    private final AuditLogService auditLogService;
    private final Clock clock;

    public CsvImportService(PharmacyProductRepository productRepository, PharmacyProductService productService,
                            PharmacySupplierRepository supplierRepository, PharmacyBatchRepository batchRepository,
                            PharmacyReceiptRepository receiptRepository, PharmacyReceiptService receiptService,
                            ReceiptReversalService reversalService, ImportRowChecker rowChecker,
                            ImportBatchRepository batchLogRepository, ImportBatchItemRepository itemRepository,
                            FacilityRepository facilityRepository, AuditLogService auditLogService, Clock clock) {
        this.productRepository = productRepository;
        this.productService = productService;
        this.supplierRepository = supplierRepository;
        this.batchRepository = batchRepository;
        this.receiptRepository = receiptRepository;
        this.receiptService = receiptService;
        this.reversalService = reversalService;
        this.rowChecker = rowChecker;
        this.batchLogRepository = batchLogRepository;
        this.itemRepository = itemRepository;
        this.facilityRepository = facilityRepository;
        this.auditLogService = auditLogService;
        this.clock = clock;
    }

    public record ImportResult(UUID batchId, int rowsImported, int productsCreated, int receiptsCreated,
                               long unitsReceived, int scheduledRows) {
    }

    @Transactional(readOnly = true)
    public List<CheckedRow> check(UUID supplierId, String invoiceNumber, List<ImportRow> rows) {
        return rowChecker.check(rows, contextFor(supplierId, invoiceNumber, rows));
    }

    @Transactional
    public ImportResult run(UUID facilityId, UUID supplierId, String invoiceNumber, String fileName,
                            List<ImportRow> rows, UUID actorUserId, String actorName) {
        facilityRepository.findById(facilityId).orElseThrow(FacilityNotFoundException::new);
        List<CheckedRow> checked = check(supplierId, invoiceNumber, rows);
        requireEveryRowOk(checked);

        Map<String, PharmacyProduct> createdByKey = createMissingProducts(checked, facilityId, actorUserId,
                actorName);
        ensureAssortment(checked, facilityId);

        String token = UUID.randomUUID().toString();
        List<PharmacyReceipt> receipts = new ArrayList<>();
        int groupNumber = 0;
        for (var group : groupIntoReceipts(checked, createdByKey).entrySet()) {
            groupNumber++;
            ReceiveStockCommand command = new ReceiveStockCommand(facilityId, group.getKey().supplierId(),
                    group.getKey().invoice(), sourceReference(fileName), null, group.getValue());
            receipts.add(receiptService.receive(command, "csv-import:" + token + ":" + groupNumber, actorUserId,
                    actorName));
        }

        long units = checked.stream().mapToLong(CheckedRow::quantity).sum();
        int scheduledRows = (int) checked.stream().filter(CheckedRow::scheduled).count();
        ImportBatch batch = batchLogRepository.save(new ImportBatch(facilityId, fileName, checked.size(),
                createdByKey.size(), receipts.size(), units, actorUserId, actorName, clock.instant()));
        rememberWhatWasCreated(batch, createdByKey.values(), receipts);

        auditLogService.append(actorUserId, facilityId, "STOCK_IMPORTED", "PharmacyImportBatch",
                batch.getId().toString(), null, AuditDetails.of("rows", checked.size(), "productsCreated",
                        createdByKey.size(), "receipts", receipts.size(), "units", units));
        return new ImportResult(batch.getId(), checked.size(), createdByKey.size(), receipts.size(), units,
                scheduledRows);
    }

    @Transactional
    public ImportBatch undo(UUID batchId, UUID actorUserId, String actorName) {
        ImportBatch batch = batchLogRepository.findByIdForUpdate(batchId)
                .orElseThrow(ImportBatchNotFoundException::new);
        if (batch.getStatus() == ImportBatchStatus.UNDONE) {
            throw new ImportConflictException("This import has already been undone.");
        }
        if (!isUndoable(batch)) {
            throw new ImportConflictException("The 24-hour undo window has passed. "
                    + "Reverse the receipts one by one from the receiving history instead.");
        }

        List<ImportBatchItem> items = itemRepository.findByBatchId(batchId);
        for (ImportBatchItem item : items) {
            if (item.getType() == ImportBatchItem.Type.RECEIPT) {
                reversalService.reverse(item.getRefId(), "CSV import undone", actorUserId, actorName);
            }
        }
        // Products can only be archived once their stock is gone, so they go last.
        for (ImportBatchItem item : items) {
            if (item.getType() == ImportBatchItem.Type.PRODUCT) {
                productService.archive(item.getRefId(), actorUserId, actorName);
            }
        }
        batch.markUndone(actorName, clock.instant());
        batchLogRepository.save(batch);
        auditLogService.append(actorUserId, batch.getFacilityId(), "STOCK_IMPORT_UNDONE", "PharmacyImportBatch",
                batch.getId().toString(), null, AuditDetails.of("rows", batch.getRowsImported()));
        return batch;
    }

    @Transactional(readOnly = true)
    public List<ImportBatch> recent(UUID facilityId) {
        return batchLogRepository.findTop20ByFacilityIdOrderByCreatedAtDesc(facilityId);
    }

    public boolean isUndoable(ImportBatch batch) {
        return batch.getStatus() == ImportBatchStatus.ACTIVE
                && clock.instant().isBefore(batch.getCreatedAt().plus(UNDO_WINDOW));
    }

    public Instant undoableUntil(ImportBatch batch) {
        return batch.getCreatedAt().plus(UNDO_WINDOW);
    }

    private Context contextFor(UUID supplierId, String invoiceNumber, List<ImportRow> rows) {
        List<String> keys = rows.stream().map(row -> ImportRowChecker.productKey(row.sku()))
                .filter(key -> !key.isEmpty()).distinct().toList();
        Map<String, PharmacyProduct> productsByKey = keys.isEmpty() ? Map.of()
                : productRepository.findByCodeNormalizedIn(keys).stream().collect(Collectors.toMap(
                        product -> ImportRowChecker.productKey(product.getCode()), product -> product));
        // The look-alike search needs the whole catalogue, but only when a SKU is unknown.
        Collection<PharmacyProduct> catalogue = productsByKey.keySet().containsAll(keys) ? List.of()
                : productRepository.findAll();
        List<PharmacySupplier> suppliers = supplierRepository.findAll().stream()
                .filter(supplier -> supplier.isActive() && !supplier.wasMerged()).toList();
        return new Context(productsByKey, catalogue, suppliers, fileSupplier(supplierId), invoiceNumber,
                LocalDate.now(clock), (productId, lot) -> batchRepository.findMatching(productId, null, lot),
                receiptRepository::existsLiveInvoice);
    }

    private PharmacySupplier fileSupplier(UUID supplierId) {
        if (supplierId == null) {
            return null;
        }
        PharmacySupplier supplier = supplierRepository.findById(supplierId)
                .orElseThrow(SupplierNotFoundException::new);
        if (!supplier.isActive()) {
            throw new PharmacyValidationException("\"" + supplier.getName()
                    + "\" is archived. Reactivate the supplier or choose another one.");
        }
        return supplier;
    }

    private void requireEveryRowOk(List<CheckedRow> checked) {
        long problemRows = checked.stream().filter(CheckedRow::isProblem).count();
        if (problemRows > 0) {
            throw new PharmacyValidationException(problemRows + " row" + (problemRows == 1 ? " needs" : "s need")
                    + " a decision before the file can be imported. Run the check again to see which.");
        }
    }

    private Map<String, PharmacyProduct> createMissingProducts(List<CheckedRow> checked, UUID facilityId,
                                                               UUID actorUserId, String actorName) {
        Map<String, PharmacyProduct> createdByKey = new LinkedHashMap<>();
        for (CheckedRow row : checked) {
            var spec = row.newProduct();
            if (spec == null || createdByKey.containsKey(ImportRowChecker.productKey(spec.code()))) {
                continue;
            }
            PharmacyProduct product = productService.create(spec.code(), spec.name(), null, null, null,
                    spec.category(), spec.unit(), spec.packSize(), null, null, spec.batchTracked(),
                    spec.expiryTracked(), null, new ProductHandling(false, spec.schedule(), false, null),
                    facilityId, null, null, actorUserId, actorName);
            createdByKey.put(ImportRowChecker.productKey(spec.code()), product);
        }
        return createdByKey;
    }

    // A product the pharmacy already has may never have been stocked at this facility.
    private void ensureAssortment(List<CheckedRow> checked, UUID facilityId) {
        checked.stream().map(CheckedRow::product).filter(product -> product != null).distinct()
                .forEach(product -> productService.getOrCreateAssortment(product.getId(), facilityId, null, null));
    }

    private record ReceiptGroup(UUID supplierId, String invoice) {
    }

    private Map<ReceiptGroup, List<ReceiveLineCommand>> groupIntoReceipts(List<CheckedRow> checked,
                                                                          Map<String, PharmacyProduct> createdByKey) {
        Map<ReceiptGroup, List<ReceiveLineCommand>> groups = new LinkedHashMap<>();
        for (CheckedRow row : checked.stream().filter(row -> row.quantity() > 0).toList()) {
            PharmacyProduct product = row.product() != null ? row.product()
                    : createdByKey.get(ImportRowChecker.productKey(row.newProduct().code()));
            ReceiptGroup group = new ReceiptGroup(row.supplier() == null ? null : row.supplier().getId(),
                    row.invoice());
            groups.computeIfAbsent(group, ignored -> new ArrayList<>()).add(new ReceiveLineCommand(product.getId(),
                    null, row.lot(), row.expiry(), row.expiry() == null ? null : ExpiryPrecision.DAY, null, null,
                    row.quantity(), List.of(), null, null, null));
        }
        return groups;
    }

    private void rememberWhatWasCreated(ImportBatch batch, Collection<PharmacyProduct> products,
                                        List<PharmacyReceipt> receipts) {
        List<ImportBatchItem> items = new ArrayList<>();
        products.forEach(product -> items.add(new ImportBatchItem(batch.getId(), ImportBatchItem.Type.PRODUCT,
                product.getId())));
        receipts.forEach(receipt -> items.add(new ImportBatchItem(batch.getId(), ImportBatchItem.Type.RECEIPT,
                receipt.getId())));
        itemRepository.saveAll(items);
    }

    private static String sourceReference(String fileName) {
        String reference = fileName == null || fileName.isBlank() ? "CSV import" : "CSV import: " + fileName.trim();
        return reference.length() <= MAX_SOURCE_REFERENCE ? reference : reference.substring(0, MAX_SOURCE_REFERENCE);
    }
}
