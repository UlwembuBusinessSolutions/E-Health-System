package co.ehealth.platform.pharmacy.receiving;

import co.ehealth.platform.pharmacy.stock.PharmacyReceipt;
import co.ehealth.platform.pharmacy.stock.PharmacyReceiptLine;
import co.ehealth.platform.pharmacy.stock.PharmacyStockAccount;
import co.ehealth.platform.pharmacy.stock.PharmacyStockAccountRepository;
import co.ehealth.platform.pharmacy.stock.PharmacyStockEntry;
import org.springframework.stereotype.Component;

import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

// Works out, from the ledger, how much of each received line has since left
// the shelf. A lot's stock is shared by every receipt of that lot, so the
// account balance alone cannot say which receipt "owns" the missing units;
// instead we count the negative movements posted AFTER the receipt's own
// entry — dispensing, write-offs, adjustments — and hand them out to the
// receipt's lines in order, never more than a line received.
//
// Three queries serve any number of receipts (entries of the receipts,
// accounts they touch, later negative entries), so a list page costs the same
// as a single receipt.
@Component
public class ReceiptUsageLookup {

    private record LotKey(UUID productId, UUID batchId) {
    }

    private record ReceiptAccountKey(UUID receiptId, UUID accountId) {
    }

    private final ReceiptLedgerRepository ledgerRepository;
    private final PharmacyStockAccountRepository stockAccountRepository;

    public ReceiptUsageLookup(ReceiptLedgerRepository ledgerRepository,
                              PharmacyStockAccountRepository stockAccountRepository) {
        this.ledgerRepository = ledgerRepository;
        this.stockAccountRepository = stockAccountRepository;
    }

    // Returns units used per receipt line id; lines with nothing used are absent.
    public Map<UUID, Integer> usedQuantityByLineId(Collection<PharmacyReceipt> receipts,
                                                   Collection<PharmacyReceiptLine> lines) {
        if (receipts.isEmpty()) {
            return Map.of();
        }
        Map<UUID, UUID> receiptIdByTransactionId = receipts.stream()
                .collect(Collectors.toMap(PharmacyReceipt::getTransactionId, PharmacyReceipt::getId));
        List<PharmacyStockEntry> receivingEntries = ledgerRepository.findByTransactionIdIn(receiptIdByTransactionId.keySet());
        Map<UUID, PharmacyStockAccount> accountsById = loadAccounts(receivingEntries);
        Map<LotKey, UUID> accountIdByLot = accountsById.values().stream()
                .collect(Collectors.toMap(a -> new LotKey(a.getProductId(), a.getBatchId()), PharmacyStockAccount::getId,
                        (first, ignored) -> first));
        Map<ReceiptAccountKey, Long> unitsLeftByReceiptAccount = unitsLeftSinceReceiving(receivingEntries,
                receiptIdByTransactionId, accountsById.keySet());
        return allocateToLines(lines, accountIdByLot, unitsLeftByReceiptAccount);
    }

    private Map<UUID, PharmacyStockAccount> loadAccounts(List<PharmacyStockEntry> entries) {
        List<UUID> accountIds = entries.stream().map(PharmacyStockEntry::getStockAccountId).distinct().toList();
        return stockAccountRepository.findAllById(accountIds).stream()
                .collect(Collectors.toMap(PharmacyStockAccount::getId, Function.identity()));
    }

    private Map<ReceiptAccountKey, Long> unitsLeftSinceReceiving(List<PharmacyStockEntry> receivingEntries,
                                                                  Map<UUID, UUID> receiptIdByTransactionId,
                                                                  Collection<UUID> accountIds) {
        Map<ReceiptAccountKey, Long> receivedAtSeq = new HashMap<>();
        for (PharmacyStockEntry entry : receivingEntries) {
            UUID receiptId = receiptIdByTransactionId.get(entry.getTransactionId());
            receivedAtSeq.merge(new ReceiptAccountKey(receiptId, entry.getStockAccountId()), entry.getSeq(), Math::min);
        }
        Map<UUID, List<PharmacyStockEntry>> negativeEntriesByAccount = ledgerRepository
                .findByStockAccountIdInAndQuantityDeltaLessThan(accountIds, 0).stream()
                .collect(Collectors.groupingBy(PharmacyStockEntry::getStockAccountId));
        Map<ReceiptAccountKey, Long> unitsLeft = new HashMap<>();
        receivedAtSeq.forEach((key, seq) -> {
            long left = negativeEntriesByAccount.getOrDefault(key.accountId(), List.of()).stream()
                    .filter(negative -> negative.getSeq() > seq)
                    .mapToLong(negative -> -negative.getQuantityDelta())
                    .sum();
            unitsLeft.put(key, left);
        });
        return unitsLeft;
    }

    private Map<UUID, Integer> allocateToLines(Collection<PharmacyReceiptLine> lines, Map<LotKey, UUID> accountIdByLot,
                                               Map<ReceiptAccountKey, Long> unitsLeftByReceiptAccount) {
        Map<UUID, Integer> usedByLineId = new HashMap<>();
        for (PharmacyReceiptLine line : lines) {
            UUID accountId = accountIdByLot.get(new LotKey(line.getProductId(), line.getBatchId()));
            if (line.getBatchId() == null || accountId == null) {
                continue;
            }
            ReceiptAccountKey key = new ReceiptAccountKey(line.getReceiptId(), accountId);
            long available = unitsLeftByReceiptAccount.getOrDefault(key, 0L);
            int used = (int) Math.min(line.getBaseQuantity(), available);
            if (used > 0) {
                usedByLineId.put(line.getId(), used);
                unitsLeftByReceiptAccount.put(key, available - used);
            }
        }
        return usedByLineId;
    }
}
