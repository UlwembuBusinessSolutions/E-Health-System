package co.ehealth.platform.pharmacy.serial;

import co.ehealth.platform.pharmacy.stock.PharmacyProductRepository;
import co.ehealth.platform.pharmacy.stock.PharmacyStockEntry;
import co.ehealth.platform.pharmacy.stock.PharmacyStockEntryRepository;
import co.ehealth.platform.pharmacy.stock.SerialUnitGateway;
import org.springframework.context.annotation.Primary;
import org.springframework.stereotype.Component;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

// Connects ledger operations (adjustments, reversals) to the serial register.
// The ledger speaks in transactions; the register links each unit to the one
// ledger entry that moved it, so this adapter picks the entry that belongs to
// the unit's product account. Marked @Primary so it replaces the
// do-nothing default without that class being deleted.
@Primary
@Component
class SerialUnitGatewayAdapter implements SerialUnitGateway {

    private final SerialUnitService serialUnitService;
    private final PharmacyProductRepository productRepository;
    private final PharmacyStockEntryRepository stockEntryRepository;

    SerialUnitGatewayAdapter(SerialUnitService serialUnitService, PharmacyProductRepository productRepository,
                             PharmacyStockEntryRepository stockEntryRepository) {
        this.serialUnitService = serialUnitService;
        this.productRepository = productRepository;
        this.stockEntryRepository = stockEntryRepository;
    }

    @Override
    public boolean isSerialTracked(UUID productId) {
        return productRepository.findById(productId).map(product -> product.isSerialTracked()).orElse(false);
    }

    @Override
    public void registerUnits(UUID productId, UUID batchId, List<String> serialNumbers, UUID transactionId) {
        serialUnitService.registerSerials(productId, batchId, serialNumbers, entryOf(transactionId));
    }

    @Override
    public void removeUnits(UUID productId, List<String> serialNumbers, UUID transactionId) {
        serialUnitService.removeSerials(productId, serialNumbers, entryOf(transactionId));
    }

    // Units the original added leave again (paired with the reversal's entry
    // on the same account); units it removed come back on the shelf.
    @Override
    public void reverseUnits(UUID originalTransactionId, UUID reversalTransactionId) {
        List<PharmacyStockEntry> originalEntries = stockEntryRepository.findByTransactionId(originalTransactionId);
        Map<UUID, UUID> reversalEntryByAccount = new HashMap<>();
        stockEntryRepository.findByTransactionId(reversalTransactionId)
                .forEach(entry -> reversalEntryByAccount.put(entry.getStockAccountId(), entry.getId()));

        Map<UUID, UUID> reversalEntryByReceivedEntry = new HashMap<>();
        originalEntries.stream()
                .filter(entry -> entry.getQuantityDelta() > 0)
                .forEach(entry -> reversalEntryByReceivedEntry.put(entry.getId(),
                        reversalEntryByAccount.get(entry.getStockAccountId())));

        if (!reversalEntryByReceivedEntry.isEmpty()) {
            serialUnitService.removeSerialsReceivedWith(reversalEntryByReceivedEntry);
        }
        serialUnitService.restoreSerialsRemovedWith(originalEntries.stream()
                .filter(entry -> entry.getQuantityDelta() < 0)
                .map(PharmacyStockEntry::getId)
                .toList());
    }

    @Override
    public Map<UUID, List<String>> inStockSerialsByBatch(UUID productId) {
        return serialUnitService.inStockSerialsByBatch(productId);
    }

    private UUID entryOf(UUID transactionId) {
        return stockEntryRepository.findByTransactionId(transactionId).stream()
                .findFirst()
                .map(PharmacyStockEntry::getId)
                .orElseThrow(() -> new IllegalStateException("Transaction " + transactionId + " has no ledger entry"));
    }
}
