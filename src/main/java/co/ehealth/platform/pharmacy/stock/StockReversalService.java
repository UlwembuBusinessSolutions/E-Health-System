package co.ehealth.platform.pharmacy.stock;

import co.ehealth.platform.core.audit.AuditLogService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

// Undoes one posted transaction with a linked REVERSAL transaction — the
// original is never edited (ledger rule 2). Reusable: whole-receipt
// reversal calls reverse() once per receipt transaction, so the "stock
// already used" rule lives only here.
@Service
public class StockReversalService {

    private final PharmacyStockTransactionRepository stockTransactionRepository;
    private final PharmacyStockEntryRepository stockEntryRepository;
    private final PharmacyStockAccountRepository stockAccountRepository;
    private final PharmacyProductRepository productRepository;
    private final PharmacyBatchRepository batchRepository;
    private final PharmacyStockLedgerService stockLedgerService;
    private final SerialUnitGateway serialUnitGateway;
    private final AuditLogService auditLogService;
    private final StockJson stockJson;

    public StockReversalService(PharmacyStockTransactionRepository stockTransactionRepository,
                                PharmacyStockEntryRepository stockEntryRepository,
                                PharmacyStockAccountRepository stockAccountRepository,
                                PharmacyProductRepository productRepository, PharmacyBatchRepository batchRepository,
                                PharmacyStockLedgerService stockLedgerService, SerialUnitGateway serialUnitGateway,
                                AuditLogService auditLogService, StockJson stockJson) {
        this.stockTransactionRepository = stockTransactionRepository;
        this.stockEntryRepository = stockEntryRepository;
        this.stockAccountRepository = stockAccountRepository;
        this.productRepository = productRepository;
        this.batchRepository = batchRepository;
        this.stockLedgerService = stockLedgerService;
        this.serialUnitGateway = serialUnitGateway;
        this.auditLogService = auditLogService;
        this.stockJson = stockJson;
    }

    private record ReversalBody(ReversalReason reason, String note) {
    }

    @Transactional
    public PharmacyStockTransaction reverse(UUID transactionId, ReversalReason reason, String note, StockActor actor) {
        PharmacyStockTransaction original = stockTransactionRepository.findById(transactionId)
                .orElseThrow(StockTransactionNotFoundException::new);
        ReversalRules.requireReversible(original.getType());
        ReversalRules.requireNoteWhenOther(reason, note);
        if (stockTransactionRepository.existsByReversalOfTransactionId(transactionId)) {
            throw new TransactionAlreadyReversedException();
        }

        List<PharmacyStockEntry> originalEntries = stockEntryRepository.findByTransactionId(transactionId);
        Map<UUID, PharmacyStockAccount> accountsById = loadAccounts(originalEntries);
        requireStockNotUsed(originalEntries, accountsById);

        // One reversal per transaction is the rule, so the key is derived
        // from the original rather than supplied by the client; the unique
        // key also stops two concurrent reversals from both posting.
        PharmacyStockTransaction reversal = stockLedgerService.postEntries(StockTransactionType.REVERSAL,
                original.getFacilityId(), actor.userId(), actor.name(), StockNotes.normalized(note), null,
                "reversal-of-" + transactionId, stockJson.hash(new ReversalBody(reason, note)),
                LedgerContext.of(original).reversing(transactionId, reason.name()),
                oppositeEntries(originalEntries, accountsById));

        serialUnitGateway.reverseUnits(transactionId, reversal.getId());
        auditLogService.append(actor.userId(), original.getFacilityId(), "STOCK_REVERSED",
                "PharmacyStockTransaction", reversal.getId().toString(), transactionId.toString(),
                stockJson.toJson(new ReversalBody(reason, note)));
        return reversal;
    }

    private Map<UUID, PharmacyStockAccount> loadAccounts(List<PharmacyStockEntry> entries) {
        Set<UUID> accountIds = entries.stream().map(PharmacyStockEntry::getStockAccountId)
                .collect(Collectors.toSet());
        return stockAccountRepository.findAllById(accountIds).stream()
                .collect(Collectors.toMap(PharmacyStockAccount::getId, Function.identity()));
    }

    private void requireStockNotUsed(List<PharmacyStockEntry> entries, Map<UUID, PharmacyStockAccount> accountsById) {
        long firstSeq = entries.stream().mapToLong(PharmacyStockEntry::getSeq).min().orElse(0);
        Set<UUID> accountsWithLaterOutflow = Set.copyOf(stockEntryRepository.findAccountIdsWithMovementsAfter(
                accountsById.keySet(), firstSeq, ReversalRules.STOCK_OUTFLOW_TYPES));
        for (PharmacyStockEntry entry : entries) {
            PharmacyStockAccount account = accountsById.get(entry.getStockAccountId());
            boolean outflowSince = accountsWithLaterOutflow.contains(account.getId());
            if (ReversalRules.isStockUsed(entry.getQuantityDelta(), account.getQuantity(), outflowSince)) {
                throw new StockReversalBlockedException(usedStockMessage(account));
            }
        }
    }

    private String usedStockMessage(PharmacyStockAccount account) {
        String product = productRepository.findById(account.getProductId()).map(PharmacyProduct::getDisplayName)
                .orElse("This product");
        String lot = batchRepository.findById(account.getBatchId()).map(PharmacyBatch::getLotNumber).orElse("N/A");
        return "Some of this stock (" + product + ", lot " + lot + ") has already been dispensed or written off, "
                + "so the movement can't be reversed. Use Adjust stock to correct what is left on the shelf.";
    }

    private List<PharmacyStockLedgerService.EntryRequest> oppositeEntries(List<PharmacyStockEntry> entries,
                                                                           Map<UUID, PharmacyStockAccount> accounts) {
        return entries.stream().map(entry -> {
            PharmacyStockAccount account = accounts.get(entry.getStockAccountId());
            return new PharmacyStockLedgerService.EntryRequest(account.getProductId(), account.getBatchId(),
                    account.getLocationId(), account.getBucket(), -entry.getQuantityDelta());
        }).toList();
    }
}
