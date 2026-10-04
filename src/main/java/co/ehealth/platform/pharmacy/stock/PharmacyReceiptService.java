package co.ehealth.platform.pharmacy.stock;

import co.ehealth.platform.core.audit.AuditLogService;
import co.ehealth.platform.facility.Facility;
import co.ehealth.platform.facility.FacilityNotFoundException;
import co.ehealth.platform.facility.FacilityRepository;
import co.ehealth.platform.pharmacy.receiving.PharmacyBatchResolver;
import co.ehealth.platform.pharmacy.receiving.ReceivedEntryLocator;
import co.ehealth.platform.pharmacy.receiving.ReceiptLineValidator;
import co.ehealth.platform.pharmacy.serial.SerialUnitService;
import co.ehealth.platform.pharmacy.supplier.PharmacySupplier;
import co.ehealth.platform.pharmacy.supplier.PharmacySupplierRepository;
import co.ehealth.platform.pharmacy.supplier.SupplierNotFoundException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;
import java.util.UUID;

// The receiving workflow — plan section 8. One receipt command posts
// every line atomically through PharmacyStockLedgerService (rule 7:
// "atomically commit stock, dispensing and audit") — either the whole
// receipt lands, or none of it does; there is no partial-lines-posted
// state. "Review before posting" (plan section 11) is the frontend's
// job (a confirm step before this call), not a persisted draft this
// service can save and reopen (ReceiptStatus's own why-note on that
// simplification).
@Service
public class PharmacyReceiptService {

    private final PharmacyProductRepository productRepository;
    private final PharmacyFacilityProductRepository facilityProductRepository;
    private final PharmacyReceiptRepository receiptRepository;
    private final PharmacyReceiptLineRepository receiptLineRepository;
    private final PharmacySupplierRepository supplierRepository;
    private final PharmacyStockLedgerService stockLedgerService;
    private final PharmacyStockLocationService stockLocationService;
    private final FacilityRepository facilityRepository;
    private final AuditLogService auditLogService;
    private final ReceiptLineValidator lineValidator;
    private final PharmacyBatchResolver batchResolver;
    private final SerialUnitService serialUnitService;
    private final ReceivedEntryLocator receivedEntryLocator;
    private final ObjectMapper objectMapper;

    public PharmacyReceiptService(PharmacyProductRepository productRepository,
                                   PharmacyFacilityProductRepository facilityProductRepository,
                                   PharmacyReceiptRepository receiptRepository,
                                   PharmacyReceiptLineRepository receiptLineRepository,
                                   PharmacySupplierRepository supplierRepository,
                                   PharmacyStockLedgerService stockLedgerService,
                                   PharmacyStockLocationService stockLocationService,
                                   FacilityRepository facilityRepository, AuditLogService auditLogService,
                                   ReceiptLineValidator lineValidator, PharmacyBatchResolver batchResolver,
                                   SerialUnitService serialUnitService, ReceivedEntryLocator receivedEntryLocator,
                                   ObjectMapper objectMapper) {
        this.productRepository = productRepository;
        this.facilityProductRepository = facilityProductRepository;
        this.receiptRepository = receiptRepository;
        this.receiptLineRepository = receiptLineRepository;
        this.supplierRepository = supplierRepository;
        this.stockLedgerService = stockLedgerService;
        this.stockLocationService = stockLocationService;
        this.facilityRepository = facilityRepository;
        this.auditLogService = auditLogService;
        this.lineValidator = lineValidator;
        this.batchResolver = batchResolver;
        this.serialUnitService = serialUnitService;
        this.receivedEntryLocator = receivedEntryLocator;
        this.objectMapper = objectMapper;
    }

    // What the receiver said about a line at the door. acceptedQuantity is
    // how many of the delivered units go on the shelf; the rest are refused.
    public record LineFlag(ReceiptFlagReason reason, String note, Integer acceptedQuantity) {
    }

    // baseQuantity is the quantity DELIVERED; stockedQuantity() is what the
    // pharmacy actually accepts (equal unless the line is flagged).
    public record ReceiveLineCommand(UUID productId, String manufacturer, String lotNumber, LocalDate expiryDate,
                                      ExpiryPrecision expiryPrecision, Integer packs, Integer packSizeUsed,
                                      Integer baseQuantity, List<String> serialNumbers, BigDecimal temperatureC,
                                      Boolean coldBoxIntact, LineFlag flag) {

        // A full date with no stated precision means exactly that date.
        public ReceiveLineCommand {
            if (expiryDate != null && expiryPrecision == null) {
                expiryPrecision = ExpiryPrecision.DAY;
            }
            serialNumbers = serialNumbers == null ? List.of() : serialNumbers;
        }

        public int stockedQuantity() {
            return flag == null ? baseQuantity : flag.acceptedQuantity();
        }

        public int rejectedQuantity() {
            return baseQuantity - stockedQuantity();
        }
    }

    public record ReceiveStockCommand(UUID facilityId, UUID supplierId, String invoiceNumber,
                                       String sourceReference, String supplierName,
                                       List<ReceiveLineCommand> lines) {
    }

    @Transactional
    public PharmacyReceipt receive(ReceiveStockCommand command, String idempotencyKey, UUID actorUserId,
                                    String actorName) {
        Facility facility = facilityRepository.findById(command.facilityId())
                .orElseThrow(FacilityNotFoundException::new);
        PharmacyStockLocation location = stockLocationService.getOrCreateMainLocation(facility.getId());
        PharmacySupplier supplier = resolveSupplier(command.supplierId());

        List<ResolvedLine> resolvedLines = resolveLines(command, facility, actorUserId, actorName);
        List<PharmacyStockLedgerService.EntryRequest> entryRequests = entryRequestsFor(resolvedLines, location);
        if (entryRequests.isEmpty()) {
            throw new PharmacyValidationException(
                    "Every line was refused, so there is nothing to stock. Cancel this receipt instead.");
        }

        PharmacyStockTransaction transaction = stockLedgerService.postEntries(StockTransactionType.RECEIPT,
                facility.getId(), actorUserId, actorName, null, command.sourceReference(), idempotencyKey,
                hashBody(command), new LedgerContext(null, supplier == null ? null : supplier.getId(), null, null, null),
                entryRequests);

        // Idempotent replay — postEntries() returned the ORIGINAL
        // transaction from a prior identical call, so the receipt for it
        // already exists too; return that instead of inserting a duplicate.
        var existingReceipt = receiptRepository.findByTransactionId(transaction.getId());
        if (existingReceipt.isPresent()) {
            return existingReceipt.get();
        }

        PharmacyReceipt receipt = receiptRepository.save(new PharmacyReceipt(facility.getId(), location.getId(),
                nextReceiptNumber(), supplier == null ? null : supplier.getId(), command.invoiceNumber(),
                command.sourceReference(), recordedSupplierName(command, supplier), actorUserId, actorName,
                transaction.getCreatedAt(), transaction.getId()));
        receiptLineRepository.saveAll(resolvedLines.stream().map(line -> toReceiptLine(receipt, line)).toList());
        registerSerials(transaction, resolvedLines);

        auditLogService.append(actorUserId, facility.getId(), "STOCK_RECEIVED", "PharmacyReceipt",
                receipt.getId().toString(), null, serializeReceiptSummary(command));

        return receipt;
    }

    private record ResolvedLine(ReceiveLineCommand line, PharmacyProduct product, UUID batchId) {
    }

    private List<ResolvedLine> resolveLines(ReceiveStockCommand command, Facility facility, UUID actorUserId,
                                            String actorName) {
        List<ResolvedLine> resolvedLines = new ArrayList<>();
        for (ReceiveLineCommand line : command.lines()) {
            PharmacyProduct product = productRepository.findById(line.productId())
                    .orElseThrow(PharmacyProductNotFoundException::new);
            requireReceivable(product, facility);
            lineValidator.validate(product, line);
            // A fully refused line stocks nothing, so it gets no lot either.
            UUID batchId = line.stockedQuantity() == 0 ? null : batchResolver.resolve(product, line.manufacturer(),
                    line.lotNumber(), line.expiryDate(), line.expiryPrecision(), actorUserId, actorName).getId();
            resolvedLines.add(new ResolvedLine(line, product, batchId));
        }
        return resolvedLines;
    }

    private void requireReceivable(PharmacyProduct product, Facility facility) {
        if (!product.isActive()) {
            throw new ProductArchivedException();
        }
        if (facilityProductRepository.findByProductIdAndFacilityId(product.getId(), facility.getId()).isEmpty()) {
            throw new ProductNotStockedAtFacilityException();
        }
    }

    private List<PharmacyStockLedgerService.EntryRequest> entryRequestsFor(List<ResolvedLine> resolvedLines,
                                                                           PharmacyStockLocation location) {
        return resolvedLines.stream()
                .filter(resolved -> resolved.line().stockedQuantity() > 0)
                .map(resolved -> new PharmacyStockLedgerService.EntryRequest(resolved.product().getId(),
                        resolved.batchId(), location.getId(), StockBucket.AVAILABLE,
                        resolved.line().stockedQuantity()))
                .toList();
    }

    private PharmacyReceiptLine toReceiptLine(PharmacyReceipt receipt, ResolvedLine resolved) {
        ReceiveLineCommand line = resolved.line();
        LineFlag flag = line.flag();
        return new PharmacyReceiptLine(receipt.getId(), line.productId(), line.manufacturer(), line.lotNumber(),
                line.expiryDate(), line.expiryPrecision(), line.packs(), line.packSizeUsed(),
                line.stockedQuantity(), resolved.batchId(), line.rejectedQuantity(),
                flag == null ? null : flag.reason(), flag == null ? null : flag.note(), line.temperatureC(),
                line.coldBoxIntact());
    }

    // Serial numbers are registered against the very ledger entry that
    // brought the units in, so a serial can never exist without its stock.
    private void registerSerials(PharmacyStockTransaction transaction, List<ResolvedLine> resolvedLines) {
        List<ResolvedLine> serialLines = resolvedLines.stream()
                .filter(resolved -> resolved.product().isSerialTracked() && resolved.line().stockedQuantity() > 0)
                .toList();
        if (serialLines.isEmpty()) {
            return;
        }
        Map<UUID, UUID> entryIdByProduct = receivedEntryLocator.entryIdByProduct(transaction.getId());
        for (ResolvedLine resolved : serialLines) {
            serialUnitService.registerSerials(resolved.product().getId(), resolved.batchId(),
                    resolved.line().serialNumbers(), entryIdByProduct.get(resolved.product().getId()));
        }
    }

    private PharmacySupplier resolveSupplier(UUID supplierId) {
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

    // The name written on the receipt is the supplier's name at the time of
    // receiving, so later renames or merges never rewrite what the paperwork said.
    private String recordedSupplierName(ReceiveStockCommand command, PharmacySupplier supplier) {
        return supplier != null ? supplier.getName() : command.supplierName();
    }

    private String nextReceiptNumber() {
        return String.format("RCV-%06d", receiptRepository.nextReceiptNumberValue());
    }

    // Canonical, order-independent-by-field-but-order-preserving-by-line
    // representation of the command's business content — used only to
    // detect "same idempotency key, different request" (IdempotencyConflictException),
    // never persisted or returned to the caller.
    private String hashBody(ReceiveStockCommand command) {
        try {
            String canonical = objectMapper.writeValueAsString(command);
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(canonical.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hash);
        } catch (NoSuchAlgorithmException | com.fasterxml.jackson.core.JsonProcessingException e) {
            throw new IllegalStateException("Failed to hash receipt body", e);
        }
    }

    private String serializeReceiptSummary(ReceiveStockCommand command) {
        try {
            int totalLines = command.lines().size();
            long totalQuantity = command.lines().stream().mapToLong(ReceiveLineCommand::stockedQuantity).sum();
            return objectMapper.writeValueAsString(new ReceiptSummary(totalLines, totalQuantity,
                    command.sourceReference()));
        } catch (com.fasterxml.jackson.core.JsonProcessingException e) {
            return null;
        }
    }

    private record ReceiptSummary(int lines, long totalQuantity, String sourceReference) {
    }
}
