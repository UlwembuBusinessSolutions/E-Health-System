package co.ehealth.platform.pharmacy.register;

import co.ehealth.platform.pharmacy.stock.DrugSchedule;
import co.ehealth.platform.pharmacy.stock.PharmacyProduct;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

// The register's product picker: every scheduled product the facility
// stocks with what the register says is on hand. Latest entries for all the
// products come from one query rather than one per product.
@Service
public class RegisterProductListService {

    public record RegisterProduct(UUID productId, String productName, String productCode, DrugSchedule schedule,
                                  long onHand, String currentLot) {
    }

    private final RegisterProductRepository productRepository;
    private final ScheduleRegisterEntryRepository entryRepository;

    public RegisterProductListService(RegisterProductRepository productRepository,
                                      ScheduleRegisterEntryRepository entryRepository) {
        this.productRepository = productRepository;
        this.entryRepository = entryRepository;
    }

    @Transactional(readOnly = true)
    public List<RegisterProduct> productsAt(UUID facilityId) {
        List<PharmacyProduct> products = productRepository.findScheduledAtFacility(facilityId);
        if (products.isEmpty()) {
            return List.of();
        }
        Map<UUID, ScheduleRegisterEntry> latestEntryByProduct = entryRepository
                .findLatestEntries(facilityId, products.stream().map(PharmacyProduct::getId).toList()).stream()
                .collect(Collectors.toMap(ScheduleRegisterEntry::getProductId, Function.identity()));
        return products.stream()
                .map(product -> toRegisterProduct(product, latestEntryByProduct.get(product.getId())))
                .toList();
    }

    // onHand is the register balance after the latest entry. The lot of that
    // entry is the lot the register is currently kept against; once the
    // balance reaches zero there is no current lot.
    private RegisterProduct toRegisterProduct(PharmacyProduct product, ScheduleRegisterEntry latestEntry) {
        long onHand = latestEntry == null ? 0 : latestEntry.getBalanceAfter();
        String currentLot = onHand > 0 ? latestEntry.getLotNumber() : null;
        return new RegisterProduct(product.getId(), product.getDisplayName(), product.getCode(),
                product.getSchedule(), onHand, currentLot);
    }
}
