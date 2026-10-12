package co.ehealth.platform.pharmacy.count;

import co.ehealth.platform.pharmacy.stock.PharmacyStockAccount;
import co.ehealth.platform.pharmacy.stock.StockBucket;
import org.springframework.stereotype.Component;

import java.util.Collection;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

// The live system balance of a lot, as counting sees it. Only the AVAILABLE
// bucket is counted: held stock is a separate, deliberately untouched
// quantity until the hold/release phase exists.
@Component
class CountLotBalances {

    record LotKey(UUID productId, UUID batchId) {
    }

    private final CountStockAccountRepository stockAccountRepository;

    CountLotBalances(CountStockAccountRepository stockAccountRepository) {
        this.stockAccountRepository = stockAccountRepository;
    }

    long balanceOf(UUID locationId, UUID productId, UUID batchId) {
        return stockAccountRepository
                .findByProductIdAndBatchIdAndLocationIdAndBucket(productId, batchId, locationId,
                        StockBucket.AVAILABLE)
                .map(PharmacyStockAccount::getQuantity)
                .orElse(0L);
    }

    // One query for a whole screen of lines, instead of one per line.
    Map<LotKey, Long> balancesForProducts(UUID locationId, Collection<UUID> productIds) {
        if (productIds.isEmpty()) {
            return Map.of();
        }
        return stockAccountRepository.findForProducts(locationId, StockBucket.AVAILABLE, productIds).stream()
                .collect(Collectors.toMap(account -> new LotKey(account.getProductId(), account.getBatchId()),
                        PharmacyStockAccount::getQuantity));
    }
}
