package co.ehealth.platform.pharmacy.dispensing;

import co.ehealth.platform.pharmacy.DispensingRecord;
import co.ehealth.platform.pharmacy.DispensingRecordRepository;
import co.ehealth.platform.pharmacy.Prescription;
import co.ehealth.platform.pharmacy.PrescriptionItem;
import co.ehealth.platform.pharmacy.PrescriptionOutOfStockRecord;
import co.ehealth.platform.pharmacy.PrescriptionOutOfStockRecordRepository;
import co.ehealth.platform.pharmacy.stock.PharmacyProduct;
import co.ehealth.platform.pharmacy.stock.PharmacyProductRepository;
import org.springframework.stereotype.Component;

import java.util.Collection;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

// Loads ItemFacts for a page of prescriptions with one query per kind of
// fact, regardless of how many prescriptions or items the page holds — the
// queue refreshes often, and per-item lookups would make it slow exactly
// when the pharmacy is busiest.
@Component
public class ItemFactsLoader {

    private final DispensingRecordRepository dispensingRecordRepository;
    private final PrescriptionOutOfStockRecordRepository outOfStockRecordRepository;
    private final SubstitutionLookup substitutionLookup;
    private final PharmacyProductRepository productRepository;
    private final PrescriptionReturnRepository returnRepository;
    private final ProductScheduleLookup scheduleLookup;
    private final StockLotReader lotReader;

    public ItemFactsLoader(DispensingRecordRepository dispensingRecordRepository,
                            PrescriptionOutOfStockRecordRepository outOfStockRecordRepository,
                            SubstitutionLookup substitutionLookup,
                            PharmacyProductRepository productRepository,
                            PrescriptionReturnRepository returnRepository, ProductScheduleLookup scheduleLookup,
                            StockLotReader lotReader) {
        this.dispensingRecordRepository = dispensingRecordRepository;
        this.outOfStockRecordRepository = outOfStockRecordRepository;
        this.substitutionLookup = substitutionLookup;
        this.productRepository = productRepository;
        this.returnRepository = returnRepository;
        this.scheduleLookup = scheduleLookup;
        this.lotReader = lotReader;
    }

    public ItemFacts load(Collection<Prescription> prescriptions, List<PrescriptionItem> items) {
        if (items.isEmpty()) {
            return ItemFacts.NONE;
        }
        List<UUID> itemIds = items.stream().map(PrescriptionItem::getId).toList();
        Map<UUID, PrescriptionSubstitution> substitutions = substitutionLookup.latestByItem(itemIds);

        Set<UUID> productIds = relevantProductIds(items, substitutions);
        Set<UUID> dispensingProductIds = dispensingProductIds(items, substitutions);
        Set<UUID> facilityIds = prescriptions.stream().map(Prescription::getFacilityId).collect(Collectors.toSet());

        return new ItemFacts(
                indexBy(dispensingRecordRepository.findByPrescriptionItemIdIn(itemIds),
                        DispensingRecord::getPrescriptionItemId),
                indexBy(outOfStockRecordRepository.findByPrescriptionItemIdIn(itemIds),
                        PrescriptionOutOfStockRecord::getPrescriptionItemId),
                substitutions, indexBy(productRepository.findAllById(productIds), PharmacyProduct::getId),
                returnedQuantityByItem(itemIds), scheduleLookup.schedulesFor(productIds),
                lotReader.snapshot(facilityIds, dispensingProductIds));
    }

    // Every product whose name or schedule a response may show.
    private Set<UUID> relevantProductIds(List<PrescriptionItem> items,
                                         Map<UUID, PrescriptionSubstitution> substitutions) {
        Set<UUID> productIds = new HashSet<>(dispensingProductIds(items, substitutions));
        items.stream().map(PrescriptionItem::getProductId).filter(id -> id != null).forEach(productIds::add);
        substitutions.values().forEach(substitution -> productIds.add(substitution.getSubstituteProductId()));
        return productIds;
    }

    private Set<UUID> dispensingProductIds(List<PrescriptionItem> items,
                                           Map<UUID, PrescriptionSubstitution> substitutions) {
        Set<UUID> productIds = new HashSet<>();
        for (PrescriptionItem item : items) {
            UUID productId = SubstitutionLookup.dispensingProductId(item, substitutions.get(item.getId()));
            if (productId != null) {
                productIds.add(productId);
            }
        }
        return productIds;
    }

    private Map<UUID, Integer> returnedQuantityByItem(List<UUID> itemIds) {
        if (itemIds.isEmpty()) {
            return Map.of();
        }
        return returnRepository.findByPrescriptionItemIdIn(itemIds).stream()
                .collect(Collectors.groupingBy(PrescriptionReturn::getPrescriptionItemId,
                        Collectors.summingInt(PrescriptionReturn::getQuantity)));
    }

    private static <T> Map<UUID, T> indexBy(List<T> rows, Function<T, UUID> key) {
        return rows.stream().collect(Collectors.toMap(key, Function.identity()));
    }
}
