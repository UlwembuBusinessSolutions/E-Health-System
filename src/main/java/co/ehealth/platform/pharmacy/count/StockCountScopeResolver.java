package co.ehealth.platform.pharmacy.count;

import co.ehealth.platform.pharmacy.stock.PharmacyBatch;
import co.ehealth.platform.pharmacy.stock.PharmacyBatchRepository;
import co.ehealth.platform.pharmacy.stock.PharmacyStockAccount;
import co.ehealth.platform.pharmacy.stock.StockBucket;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

// Decides which lots a new count covers. Only lots with stock on the books
// are listed; a lot that is on the shelf but not in the ledger is added
// during the count as a "found" lot instead.
@Component
class StockCountScopeResolver {

    record ScopedLot(UUID productId, UUID batchId, String lotNumber, LocalDate expiryDate) {
    }

    private final CountStockAccountRepository stockAccountRepository;
    private final PharmacyBatchRepository batchRepository;

    StockCountScopeResolver(CountStockAccountRepository stockAccountRepository,
                            PharmacyBatchRepository batchRepository) {
        this.stockAccountRepository = stockAccountRepository;
        this.batchRepository = batchRepository;
    }

    List<ScopedLot> resolve(UUID locationId, CountScope scope, String scopeText) {
        List<PharmacyStockAccount> accounts = switch (scope) {
            case ALL -> stockAccountRepository.findStocked(locationId, StockBucket.AVAILABLE);
            case AREA -> stockAccountRepository.findStockedInArea(locationId, StockBucket.AVAILABLE, scopeText);
            case PRODUCT -> stockAccountRepository.findStockedMatchingProduct(locationId, StockBucket.AVAILABLE,
                    scopeText);
        };
        return toScopedLots(accounts);
    }

    private List<ScopedLot> toScopedLots(List<PharmacyStockAccount> accounts) {
        List<UUID> batchIds = accounts.stream().map(PharmacyStockAccount::getBatchId).toList();
        Map<UUID, PharmacyBatch> batchesById = batchRepository.findAllById(batchIds).stream()
                .collect(Collectors.toMap(PharmacyBatch::getId, Function.identity()));
        return accounts.stream()
                .map(account -> toScopedLot(account, batchesById.get(account.getBatchId())))
                .toList();
    }

    private ScopedLot toScopedLot(PharmacyStockAccount account, PharmacyBatch batch) {
        return new ScopedLot(account.getProductId(), batch.getId(), batch.getLotNumber(), batch.getExpiryDate());
    }
}
