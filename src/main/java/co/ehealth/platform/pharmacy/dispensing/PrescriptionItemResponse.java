package co.ehealth.platform.pharmacy.dispensing;

import co.ehealth.platform.pharmacy.PrescriptionStatus;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

// One prescription line as the pharmacy screens see it. The first ten
// fields are the original shape; the rest describe the stock behind the line.
//
// productId is the confirmed product, or the remembered-name suggestion while
// mappingStatus is SUGGESTED (stock is only deducted after confirmation).
// dispensingProductId differs from productId only when the prescriber
// approved a substitute; every lot and stock figure below refers to
// dispensingProductId. Stock fields are empty/null once the line is fully
// dispensed or while no product is known.
public record PrescriptionItemResponse(UUID id, String drugName, String dosage, int quantity,
                                       PrescriptionStatus status, String dispensedByName, Instant dispensedAt,
                                       String markedOutOfStockByName, Instant markedOutOfStockAt,
                                       String outOfStockNote, UUID productId, MappingStatus mappingStatus,
                                       String mappedProductName, UUID dispensingProductId,
                                       String dispensingProductName, int dispensedQuantity, int remainingQuantity,
                                       int returnedQuantity, long availableQuantity, StockStatus stockStatus,
                                       LotView suggestedLot, List<LotView> usableLots,
                                       List<LotView> skippedExpiredLots, boolean isScheduled,
                                       MedicineSchedule schedule, SubstitutionStatus substitutionStatus,
                                       UUID substituteProductId, String substituteProductName) {

    public record LotView(UUID batchId, String lot, LocalDate expiryDate, long available) {
        static LotView of(LotAvailability lot) {
            return new LotView(lot.batchId(), lot.lotNumber(), lot.expiryDate(), lot.available());
        }
    }
}
