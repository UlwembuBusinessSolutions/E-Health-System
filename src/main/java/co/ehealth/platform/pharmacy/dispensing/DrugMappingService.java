package co.ehealth.platform.pharmacy.dispensing;

import co.ehealth.platform.core.audit.AuditLogService;
import co.ehealth.platform.pharmacy.Prescription;
import co.ehealth.platform.pharmacy.PrescriptionItem;
import co.ehealth.platform.pharmacy.PrescriptionItemRepository;
import co.ehealth.platform.pharmacy.stock.PharmacyProduct;
import co.ehealth.platform.pharmacy.stock.PharmacyProductNotFoundException;
import co.ehealth.platform.pharmacy.stock.PharmacyProductRepository;
import co.ehealth.platform.pharmacy.stock.ProductArchivedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.util.Collection;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

// Links free-text prescription lines to stock products. A remembered mapping
// is only ever a SUGGESTION on the queue; stock is deducted only after a
// pharmacist confirms the product for that item (plan section 9, rule 2).
@Service
public class DrugMappingService {

    private final PharmacyDrugMappingRepository mappingRepository;
    private final PharmacyProductRepository productRepository;
    private final PrescriptionItemRepository itemRepository;
    private final AuditLogService auditLogService;
    private final Clock clock;

    public DrugMappingService(PharmacyDrugMappingRepository mappingRepository,
                               PharmacyProductRepository productRepository,
                               PrescriptionItemRepository itemRepository, AuditLogService auditLogService,
                               Clock clock) {
        this.mappingRepository = mappingRepository;
        this.productRepository = productRepository;
        this.itemRepository = itemRepository;
        this.auditLogService = auditLogService;
        this.clock = clock;
    }

    // Product ids remembered for the items' drug names, keyed by item id.
    // One query for the whole batch; items that already have a confirmed
    // product are left out (nothing to suggest).
    public Map<UUID, UUID> suggestedProductIds(Collection<PrescriptionItem> items) {
        Map<UUID, String> keysByItemId = items.stream().filter(item -> item.getProductId() == null)
                .collect(Collectors.toMap(PrescriptionItem::getId, item -> DrugNames.normalise(item.getDrugName())));
        if (keysByItemId.isEmpty()) {
            return Map.of();
        }
        Map<String, UUID> productByKey = mappingRepository.findByDrugNameKeyIn(keysByItemId.values()).stream()
                .collect(Collectors.toMap(PharmacyDrugMapping::getDrugNameKey, PharmacyDrugMapping::getProductId));
        return keysByItemId.entrySet().stream().filter(entry -> productByKey.containsKey(entry.getValue()))
                .collect(Collectors.toMap(Map.Entry::getKey, entry -> productByKey.get(entry.getValue())));
    }

    // The caller holds the item's row lock, so the "already dispensed from
    // another product" check cannot race a concurrent dispense.
    @Transactional
    public PrescriptionItem confirmProduct(Prescription prescription, PrescriptionItem item, UUID productId,
                                            UUID staffId) {
        PharmacyProduct product = productRepository.findById(productId)
                .orElseThrow(PharmacyProductNotFoundException::new);
        if (!product.isActive()) {
            throw new ProductArchivedException();
        }
        if (item.getDispensedQuantity() > 0 && !productId.equals(item.getProductId())) {
            throw new DispensingConflictException("Part of this item was already dispensed from another product, "
                    + "so its product can no longer be changed.");
        }

        item.mapToProduct(productId);
        itemRepository.save(item);
        rememberMapping(item.getDrugName(), productId, staffId);
        auditLogService.append(staffId, prescription.getFacilityId(), "PRESCRIPTION_ITEM_PRODUCT_MAPPED",
                "PrescriptionItem", item.getId().toString(), null, product.getCode());
        return item;
    }

    private void rememberMapping(String drugName, UUID productId, UUID staffId) {
        String key = DrugNames.normalise(drugName);
        mappingRepository.findByDrugNameKey(key).ifPresentOrElse(
                existing -> {
                    existing.remap(productId, staffId, clock.instant());
                    mappingRepository.save(existing);
                },
                () -> mappingRepository.save(new PharmacyDrugMapping(key, productId, staffId, clock.instant())));
    }
}
