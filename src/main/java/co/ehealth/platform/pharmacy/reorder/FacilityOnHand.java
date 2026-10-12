package co.ehealth.platform.pharmacy.reorder;

import co.ehealth.platform.pharmacy.stock.PharmacyStockAccount;
import co.ehealth.platform.pharmacy.stock.PharmacyStockAccountRepository;
import org.springframework.stereotype.Component;

import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

// How many units of each product a facility holds, summed across lots, from
// one query. Products with nothing on the shelf are simply absent.
@Component
class FacilityOnHand {

    private final PharmacyStockAccountRepository stockAccountRepository;

    FacilityOnHand(PharmacyStockAccountRepository stockAccountRepository) {
        this.stockAccountRepository = stockAccountRepository;
    }

    Map<UUID, Long> byProduct(UUID facilityId) {
        return stockAccountRepository.findPositiveByFacility(facilityId).stream()
                .collect(Collectors.groupingBy(PharmacyStockAccount::getProductId,
                        Collectors.summingLong(PharmacyStockAccount::getQuantity)));
    }
}
