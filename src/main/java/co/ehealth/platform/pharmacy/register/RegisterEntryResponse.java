package co.ehealth.platform.pharmacy.register;

import co.ehealth.platform.pharmacy.stock.PharmacyProduct;

import java.time.Instant;
import java.util.UUID;

public record RegisterEntryResponse(UUID id, UUID facilityId, UUID productId, String productName,
                                    String productCode, Instant entryAt, RegisterEntryKind kind, String rxSerial,
                                    String patientName, String patientIdRef, String prescriberName,
                                    String prescriberRegNo, long quantityIn, long quantityOut, long balanceAfter,
                                    String lotNumber, String dispensedByName, String witnessedByName,
                                    UUID ledgerTransactionId, String reason) {

    static RegisterEntryResponse from(ScheduleRegisterEntry entry, PharmacyProduct product) {
        return new RegisterEntryResponse(entry.getId(), entry.getFacilityId(), entry.getProductId(),
                product.getDisplayName(), product.getCode(), entry.getEntryAt(), entry.getKind(),
                entry.getRxSerial(), entry.getPatientName(), entry.getPatientIdRef(), entry.getPrescriberName(),
                entry.getPrescriberRegNo(), entry.getQuantityIn(), entry.getQuantityOut(), entry.getBalanceAfter(),
                entry.getLotNumber(), entry.getDispensedByName(), entry.getWitnessedByName(),
                entry.getLedgerTransactionId(), entry.getReason());
    }
}
