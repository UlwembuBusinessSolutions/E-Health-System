package co.ehealth.platform.pharmacy.integration;

import co.ehealth.platform.pharmacy.dispensing.ProductScheduleLookup;
import co.ehealth.platform.pharmacy.register.ScheduledProductLookup;
import co.ehealth.platform.pharmacy.stock.DrugSchedule;
import co.ehealth.platform.pharmacy.stock.PharmacyProduct;
import co.ehealth.platform.pharmacy.stock.PharmacyProductRepository;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.Collection;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

// The product catalogue owns the Schedule 5/6 classification; dispensing and
// the scheduled-medicines register each only need to ask "is this product
// scheduled?". One adapter answers for both so they can never disagree.
@Component
class ProductScheduleAdapter implements ScheduledProductLookup, ProductScheduleLookup {

    private final PharmacyProductRepository productRepository;

    ProductScheduleAdapter(PharmacyProductRepository productRepository) {
        this.productRepository = productRepository;
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<DrugSchedule> scheduleOf(UUID productId) {
        return productRepository.findById(productId).map(PharmacyProduct::getSchedule);
    }

    @Override
    @Transactional(readOnly = true)
    public Map<UUID, DrugSchedule> schedulesFor(Collection<UUID> productIds) {
        Map<UUID, DrugSchedule> schedules = new HashMap<>();
        if (productIds.isEmpty()) {
            return schedules;
        }
        for (PharmacyProduct product : productRepository.findAllById(productIds)) {
            if (product.getSchedule() != null) {
                schedules.put(product.getId(), product.getSchedule());
            }
        }
        return schedules;
    }
}
