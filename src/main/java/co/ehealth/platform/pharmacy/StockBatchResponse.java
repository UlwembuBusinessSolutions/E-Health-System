package co.ehealth.platform.pharmacy;

import java.time.LocalDate;
import java.util.UUID;

public record StockBatchResponse(UUID id, UUID facilityId, String drugName, String batchNumber, String barcode,
                                  LocalDate expiryDate, int quantityOnHand) {
    static StockBatchResponse from(StockBatch batch) {
        return new StockBatchResponse(batch.getId(), batch.getFacilityId(), batch.getDrugName(), batch.getBatchNumber(),
                batch.getBarcode(), batch.getExpiryDate(), batch.getQuantityOnHand());
    }
}
