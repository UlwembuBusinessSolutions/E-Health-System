package co.ehealth.platform.pharmacy.dispensing;

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
                        Map<UUID, UUID> suggestedProductIds,
                        Map<UUID, PrescriptionSubstitution> latestSubstitutions,
                        Map<UUID, PharmacyProduct> products, Map<UUID, Integer> returnedByItem,
                        Map<UUID, MedicineSchedule> schedules, StockSnapshot stock) {

    static final ItemFacts NONE = new ItemFacts(Map.of(), Map.of(), Map.of(), Map.of(), Map.of(), Map.of(), Map.of(),
            new StockSnapshot(List.of(), LocalDate.EPOCH));

    // The product stock is checked against: an approved substitute, else the
    // confirmed product, else the remembered-name suggestion (so the pharmacist
    // sees availability before confirming). Null when nothing is known.
    public UUID dispensingProductId(PrescriptionItem item) {
        UUID confirmedOrSubstitute = SubstitutionLookup.dispensingProductId(item,
                latestSubstitutions.get(item.getId()));
        return confirmedOrSubstitute != null ? confirmedOrSubstitute : suggestedProductIds.get(item.getId());
    }

    public StockPicture shelf(Prescription prescription, PrescriptionItem item) {
        UUID productId = dispensingProductId(item);
        return productId == null ? StockPicture.EMPTY : stock.shelf(prescription.getFacilityId(), productId);
    }

    public MappingStatus mappingStatus(PrescriptionItem item) {
        if (item.getProductId() != null) {
            return MappingStatus.CONFIRMED;
        }
        return suggestedProductIds.containsKey(item.getId()) ? MappingStatus.SUGGESTED : MappingStatus.UNMAPPED;
    }

    public String productName(UUID productId) {
        PharmacyProduct product = productId == null ? null : products.get(productId);
        return product == null ? null : product.getDisplayName();
    }
}
