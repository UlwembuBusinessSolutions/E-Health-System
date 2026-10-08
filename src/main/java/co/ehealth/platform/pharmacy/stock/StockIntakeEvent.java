package co.ehealth.platform.pharmacy.stock;

import java.util.List;
import java.util.UUID;

// Published, inside the posting transaction, when stock enters a facility
// through a receipt or the one-time opening balance. Other parts of the
// pharmacy module (the scheduled-medicines register) react to it, so the
// stock code never has to know they exist and a failure in a listener rolls
// the whole intake back.
public record StockIntakeEvent(UUID facilityId, UUID recordedBy, UUID ledgerTransactionId, boolean openingBalance,
                               List<IntakeLot> lots) {

    public record IntakeLot(UUID productId, String lotNumber, long quantity) {
    }
}
