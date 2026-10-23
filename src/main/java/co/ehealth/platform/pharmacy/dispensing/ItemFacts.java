package co.ehealth.platform.pharmacy.dispensing;

import co.ehealth.platform.pharmacy.stock.DrugSchedule;
import co.ehealth.platform.pharmacy.DispensingRecord;
import co.ehealth.platform.pharmacy.Prescription;
import co.ehealth.platform.pharmacy.PrescriptionItem;
import co.ehealth.platform.pharmacy.PrescriptionOutOfStockRecord;
import co.ehealth.platform.pharmacy.stock.PharmacyProduct;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;

// Everything needed to describe a page of prescription items, loaded in a
// fixed number of queries by ItemFactsLoader and then read without touching
// the database again.
public record ItemFacts(Map<UUID, DispensingRecord> dispensingRecords,
                        Map<UUID, PrescriptionOutOfStockRecord> outOfStockRecords,
                        Map<UUID, PrescriptionSubstitution> latestSubstitutions,
                        Map<UUID, PharmacyProduct> products, Map<UUID, Integer> returnedByItem,
                        Map<UUID, DrugSchedule> schedules, StockSnapshot stock) {

    static final ItemFacts NONE = new ItemFacts(Map.of(), Map.of(), Map.of(), Map.of(), Map.of(), Map.of(),
            new StockSnapshot(List.of(), LocalDate.EPOCH));

    // The product stock is checked against: a substitute the prescriber approved,
    // else the product the prescriber chose. Null for a legacy line the prescriber
    // never matched to a product.
    public UUID dispensingProductId(PrescriptionItem item) {
        return SubstitutionLookup.dispensingProductId(item, latestSubstitutions.get(item.getId()));
    }

    public StockPicture shelf(Prescription prescription, PrescriptionItem item) {
        UUID productId = dispensingProductId(item);
        return productId == null ? StockPicture.EMPTY : stock.shelf(prescription.getFacilityId(), productId);
    }

    public MappingStatus mappingStatus(PrescriptionItem item) {
        return item.getProductId() != null ? MappingStatus.CONFIRMED : MappingStatus.UNMAPPED;
    }

    public String productName(UUID productId) {
        PharmacyProduct product = productId == null ? null : products.get(productId);
        return product == null ? null : product.getDisplayName();
    }
}
