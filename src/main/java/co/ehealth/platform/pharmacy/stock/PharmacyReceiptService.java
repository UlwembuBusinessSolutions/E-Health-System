package co.ehealth.platform.pharmacy.stock;

import co.ehealth.platform.core.audit.AuditLogService;
import co.ehealth.platform.facility.Facility;
import co.ehealth.platform.facility.FacilityNotFoundException;
import co.ehealth.platform.facility.FacilityRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Clock;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.List;
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
    private final PharmacyBatchRepository batchRepository;
    private final PharmacyReceiptRepository receiptRepository;
    private final PharmacyReceiptLineRepository receiptLineRepository;
    private final PharmacyStockLedgerService stockLedgerService;
    private final PharmacyStockLocationService stockLocationService;
    private final FacilityRepository facilityRepository;
    private final AuditLogService auditLogService;
    private final ObjectMapper objectMapper;
    private final Clock clock;

    public PharmacyReceiptService(PharmacyProductRepository productRepository,
                                   PharmacyFacilityProductRepository facilityProductRepository,
                                   PharmacyBatchRepository batchRepository,
                                   PharmacyReceiptRepository receiptRepository,
                                   PharmacyReceiptLineRepository receiptLineRepository,
                                   PharmacyStockLedgerService stockLedgerService,
                                   PharmacyStockLocationService stockLocationService,
                                   FacilityRepository facilityRepository, AuditLogService auditLogService,
                                   ObjectMapper objectMapper, Clock clock) {
        this.productRepository = productRepository;
        this.facilityProductRepository = facilityProductRepository;
        this.batchRepository = batchRepository;
        this.receiptRepository = receiptRepository;
        this.receiptLineRepository = receiptLineRepository;
        this.stockLedgerService = stockLedgerService;
        this.stockLocationService = stockLocationService;
        this.facilityRepository = facilityRepository;
        this.auditLogService = auditLogService;
        this.objectMapper = objectMapper;
        this.clock = clock;
    }

    public record ReceiveLineCommand(UUID productId, String manufacturer, String lotNumber, LocalDate expiryDate,
                                      ExpiryPrecision expiryPrecision, Integer packs, Integer packSizeUsed,
                                      Integer baseQuantity) {
    }

    public record ReceiveStockCommand(UUID facilityId, String sourceReference, String supplierName,
                                       List<ReceiveLineCommand> lines) {
    }

    @Transactional
    public PharmacyReceipt receive(ReceiveStockCommand command, String idempotencyKey, UUID actorUserId,
                                    String actorName) {
        Facility facility = facilityRepository.findById(command.facilityId())
                .orElseThrow(FacilityNotFoundException::new);
        PharmacyStockLocation location = stockLocationService.getOrCreateMainLocation(facility.getId());

        List<PharmacyStockLedgerService.EntryRequest> entryRequests = new ArrayList<>();
        List<ResolvedLine> resolvedLines = new ArrayList<>();

        for (ReceiveLineCommand line : command.lines()) {
            PharmacyProduct product = productRepository.findById(line.productId())
                    .orElseThrow(PharmacyProductNotFoundException::new);
            if (!product.isActive()) {
                throw new ProductArchivedException();
            }
            if (facilityProductRepository.findByProductIdAndFacilityId(product.getId(), facility.getId()).isEmpty()) {
                throw new ProductNotStockedAtFacilityException();
            }
            if (product.isExpiryTracked() && line.expiryDate() == null) {
                throw new MissingExpiryException(product.getDisplayName());
            }
            if (line.baseQuantity() == null || line.baseQuantity() <= 0) {
                throw new IllegalArgumentException("Quantity must be a positive whole number.");
            }

            PharmacyBatch batch = resolveBatch(product, line, actorUserId, actorName);
            entryRequests.add(new PharmacyStockLedgerService.EntryRequest(product.getId(), batch.getId(),
                    location.getId(), StockBucket.AVAILABLE, line.baseQuantity()));
            resolvedLines.add(new ResolvedLine(line, batch.getId()));
        }

        String bodyHash = hashBody(command);
        PharmacyStockTransaction transaction = stockLedgerService.postEntries(StockTransactionType.RECEIPT,
                facility.getId(), actorUserId, actorName, null, command.sourceReference(), idempotencyKey, bodyHash,
                entryRequests);

        // Idempotent replay — postEntries() returned the ORIGINAL
        // transaction from a prior identical call, so the receipt for it
        // already exists too; return that instead of inserting a duplicate.
        var existingReceipt = receiptRepository.findByTransactionId(transaction.getId());
        if (existingReceipt.isPresent()) {
            return existingReceipt.get();
        }

        PharmacyReceipt receipt = receiptRepository.save(new PharmacyReceipt(facility.getId(), location.getId(),
                command.sourceReference(), command.supplierName(), actorUserId, actorName,
                transaction.getCreatedAt(), transaction.getId()));

        List<PharmacyReceiptLine> receiptLines = resolvedLines.stream()
                .map(resolved -> new PharmacyReceiptLine(receipt.getId(), resolved.line().productId(),
                        resolved.line().manufacturer(), resolved.line().lotNumber(), resolved.line().expiryDate(),
                        resolved.line().expiryPrecision(), resolved.line().packs(), resolved.line().packSizeUsed(),
                        resolved.line().baseQuantity(), resolved.batchId()))
                .toList();
        receiptLineRepository.saveAll(receiptLines);

        auditLogService.append(actorUserId, facility.getId(), "STOCK_RECEIVED", "PharmacyReceipt",
                receipt.getId().toString(), null, serializeReceiptSummary(command));

        return receipt;
    }

    private record ResolvedLine(ReceiveLineCommand line, UUID batchId) {
    }

    // Untracked products (batchTracked = false) always resolve to one
    // canonical "N/A" lot per product — every stock account still needs a
    // non-null batch id (V35's own why-note), this is just never shown as
    // a real batch to the user. Tracked products resolve/create a real lot
    // by (product, manufacturer, lotNumber), rejecting a conflicting
    // expiry on an existing lot rather than silently accepting it (plan
    // section 6, STK-06).
    private PharmacyBatch resolveBatch(PharmacyProduct product, ReceiveLineCommand line, UUID actorUserId,
                                        String actorName) {
        if (!product.isBatchTracked()) {
            return batchRepository.findMatching(product.getId(), null, "N/A")
                    .orElseGet(() -> batchRepository.save(new PharmacyBatch(product.getId(), null, "N/A", null, null,
                            null, actorUserId, actorName, clock.instant())));
        }
        var existing = batchRepository.findMatching(product.getId(), line.manufacturer(), line.lotNumber());
        if (existing.isPresent()) {
            PharmacyBatch batch = existing.get();
            boolean expiryMatches = (batch.getExpiryDate() == null && line.expiryDate() == null)
                    || (batch.getExpiryDate() != null && batch.getExpiryDate().equals(line.expiryDate()));
            if (!expiryMatches) {
                throw new BatchExpiryConflictException(line.lotNumber());
            }
            return batch;
        }
        return batchRepository.save(new PharmacyBatch(product.getId(), line.manufacturer(), line.lotNumber(),
                line.expiryDate(), line.expiryPrecision(), line.expiryDate() != null ? line.expiryDate().toString() : null,
                actorUserId, actorName, clock.instant()));
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
            long totalQuantity = command.lines().stream().mapToLong(l -> l.baseQuantity() == null ? 0 : l.baseQuantity()).sum();
            return objectMapper.writeValueAsString(new ReceiptSummary(totalLines, totalQuantity,
                    command.sourceReference()));
        } catch (com.fasterxml.jackson.core.JsonProcessingException e) {
            return null;
        }
    }

    private record ReceiptSummary(int lines, long totalQuantity, String sourceReference) {
    }
}
