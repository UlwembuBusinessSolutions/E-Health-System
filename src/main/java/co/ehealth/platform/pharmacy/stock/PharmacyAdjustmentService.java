package co.ehealth.platform.pharmacy.stock;

import co.ehealth.platform.core.audit.AuditLogService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

// Manual stock corrections — remove (expired, damaged, lost...) or add
// (found in a count, returned by a patient...) with a mandatory reason.
// Every adjustment is a new immutable ledger entry posted through
// PharmacyStockLedgerService, never an edit of a balance. Serial-tracked
// products additionally move their units through SerialUnitGateway inside
// the same transaction.
@Service
public class PharmacyAdjustmentService {

    private static final String UNTRACKED_LOT_NUMBER = "N/A";

    private final PharmacyProductRepository productRepository;
    private final PharmacyBatchRepository batchRepository;
    private final PharmacyStockAccountRepository stockAccountRepository;
    private final PharmacyStockEntryRepository stockEntryRepository;
    private final PharmacyStockLedgerService stockLedgerService;
    private final PharmacyStockLocationService stockLocationService;
    private final SerialUnitGateway serialUnitGateway;
    private final AuditLogService auditLogService;
    private final StockJson stockJson;

    public PharmacyAdjustmentService(PharmacyProductRepository productRepository,
                                     PharmacyBatchRepository batchRepository,
                                     PharmacyStockAccountRepository stockAccountRepository,
                                     PharmacyStockEntryRepository stockEntryRepository,
                                     PharmacyStockLedgerService stockLedgerService,
                                     PharmacyStockLocationService stockLocationService,
                                     SerialUnitGateway serialUnitGateway, AuditLogService auditLogService,
                                     StockJson stockJson) {
        this.productRepository = productRepository;
        this.batchRepository = batchRepository;
        this.stockAccountRepository = stockAccountRepository;
        this.stockEntryRepository = stockEntryRepository;
        this.stockLedgerService = stockLedgerService;
        this.stockLocationService = stockLocationService;
        this.serialUnitGateway = serialUnitGateway;
        this.auditLogService = auditLogService;
        this.stockJson = stockJson;
    }

    public record AdjustmentCommand(UUID facilityId, UUID productId, UUID batchId, List<String> serialNumbers,
                                    AdjustmentMode mode, int quantity, AdjustmentReason reason, String note) {
    }

    public record AdjustmentResult(UUID transactionId, StockTransactionType type, UUID productId, UUID batchId,
                                   long quantityDelta, long lotBalanceAfter, Instant createdAt) {
    }

    @Transactional
    public AdjustmentResult adjust(AdjustmentCommand command, String idempotencyKey, StockActor actor) {
        String bodyHash = stockJson.hash(command);
        // A replay already did its serial and audit work the first time.
        Optional<PharmacyStockTransaction> replay = stockLedgerService.findPriorPosting(idempotencyKey, bodyHash);
        if (replay.isPresent()) {
            return resultOf(replay.get());
        }

        PharmacyProduct product = productRepository.findById(command.productId())
                .orElseThrow(PharmacyProductNotFoundException::new);
        if (!product.isActive()) {
            throw new ProductArchivedException();
        }
        AdjustmentRules.validate(command.mode(), command.reason(), command.note(), command.quantity(),
                command.serialNumbers(), serialUnitGateway.isSerialTracked(product.getId()));

        PharmacyStockLocation location = stockLocationService.getOrCreateMainLocation(command.facilityId());
        PharmacyBatch lot = resolveLot(product, command.batchId());
        if (command.mode() == AdjustmentMode.REMOVE) {
            long lotBalance = lotBalance(product.getId(), lot.getId(), location.getId());
            AdjustmentRules.requireWithinBalance(command.quantity(), lotBalance, describe(product, lot));
        }

        PharmacyStockTransaction transaction = stockLedgerService.postEntries(
                command.reason().transactionTypeFor(command.mode()), command.facilityId(), actor.userId(),
                actor.name(), StockNotes.normalized(command.note()), null, idempotencyKey, bodyHash,
                LedgerContext.forReason(command.reason().name()),
                List.of(new PharmacyStockLedgerService.EntryRequest(product.getId(), lot.getId(), location.getId(),
                        StockBucket.AVAILABLE, signedQuantity(command))));

        moveSerialUnits(command, lot, transaction);
        auditLogService.append(actor.userId(), command.facilityId(), "STOCK_ADJUSTED", "PharmacyStockTransaction",
                transaction.getId().toString(), null, stockJson.toJson(command));
        return resultOf(transaction);
    }

    private void moveSerialUnits(AdjustmentCommand command, PharmacyBatch lot, PharmacyStockTransaction transaction) {
        if (command.serialNumbers() == null || command.serialNumbers().isEmpty()) {
            return;
        }
        if (command.mode() == AdjustmentMode.ADD) {
            serialUnitGateway.registerUnits(command.productId(), lot.getId(), command.serialNumbers(),
                    transaction.getId());
        } else {
            serialUnitGateway.removeUnits(command.productId(), command.serialNumbers(), transaction.getId());
        }
    }

    // Tracked products must name the lot being corrected; untracked ones
    // only ever have the single canonical "N/A" lot (PharmacyReceiptService
    // creates it on first receipt), so there is nothing to choose.
    private PharmacyBatch resolveLot(PharmacyProduct product, UUID batchId) {
        if (batchId != null) {
            PharmacyBatch lot = batchRepository.findById(batchId)
                    .orElseThrow(() -> new InvalidStockRequestException("That lot could not be found."));
            if (!lot.getProductId().equals(product.getId())) {
                throw new InvalidStockRequestException("That lot belongs to a different product.");
            }
            return lot;
        }
        if (product.isBatchTracked()) {
            throw new InvalidStockRequestException("Choose the lot you are adjusting for "
                    + product.getDisplayName() + ".");
        }
        return batchRepository.findMatching(product.getId(), null, UNTRACKED_LOT_NUMBER)
                .orElseThrow(() -> new InvalidStockRequestException(product.getDisplayName()
                        + " has no stock record yet. Receive it first."));
    }

    private long lotBalance(UUID productId, UUID batchId, UUID locationId) {
        return stockAccountRepository.findByProductIdAndBatchIdAndLocationIdAndBucket(productId, batchId, locationId,
                StockBucket.AVAILABLE).map(PharmacyStockAccount::getQuantity).orElse(0L);
    }

    private static String describe(PharmacyProduct product, PharmacyBatch lot) {
        boolean untracked = UNTRACKED_LOT_NUMBER.equals(lot.getLotNumber());
        return untracked ? product.getDisplayName() : product.getDisplayName() + " lot " + lot.getLotNumber();
    }

    private static long signedQuantity(AdjustmentCommand command) {
        return command.mode() == AdjustmentMode.REMOVE ? -command.quantity() : command.quantity();
    }

    private AdjustmentResult resultOf(PharmacyStockTransaction transaction) {
        PharmacyStockEntry entry = stockEntryRepository.findByTransactionId(transaction.getId()).getFirst();
        PharmacyStockAccount account = stockAccountRepository.findById(entry.getStockAccountId()).orElseThrow();
        return new AdjustmentResult(transaction.getId(), transaction.getType(), account.getProductId(),
                account.getBatchId(), entry.getQuantityDelta(), entry.getBalanceAfter(), transaction.getCreatedAt());
    }
}
