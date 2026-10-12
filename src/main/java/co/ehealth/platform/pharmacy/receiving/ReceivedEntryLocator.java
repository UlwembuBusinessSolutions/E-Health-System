package co.ehealth.platform.pharmacy.receiving;

import co.ehealth.platform.pharmacy.stock.PharmacyStockAccount;
import co.ehealth.platform.pharmacy.stock.PharmacyStockAccountRepository;
import co.ehealth.platform.pharmacy.stock.PharmacyStockEntry;
import co.ehealth.platform.pharmacy.stock.PharmacyStockEntryRepository;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

// Answers "which ledger entry in this transaction belongs to this product?".
// A serial-tracked product always lives in its one canonical lot, so it has a
// single stock account per location and therefore one entry per posting; if a
// receipt lists the product on several lines they share that account and the
// first entry stands for all of them.
@Component
public class ReceivedEntryLocator {

    private final PharmacyStockEntryRepository stockEntryRepository;
    private final PharmacyStockAccountRepository stockAccountRepository;

    public ReceivedEntryLocator(PharmacyStockEntryRepository stockEntryRepository,
                                PharmacyStockAccountRepository stockAccountRepository) {
        this.stockEntryRepository = stockEntryRepository;
        this.stockAccountRepository = stockAccountRepository;
    }

    public Map<UUID, UUID> entryIdByProduct(UUID transactionId) {
        List<PharmacyStockEntry> entries = stockEntryRepository.findByTransactionId(transactionId);
        Map<UUID, PharmacyStockAccount> accountsById = stockAccountRepository
                .findAllById(entries.stream().map(PharmacyStockEntry::getStockAccountId).toList()).stream()
                .collect(Collectors.toMap(PharmacyStockAccount::getId, Function.identity()));
        return entries.stream().collect(Collectors.toMap(
                entry -> accountsById.get(entry.getStockAccountId()).getProductId(),
                PharmacyStockEntry::getId, (first, ignored) -> first));
    }
}
