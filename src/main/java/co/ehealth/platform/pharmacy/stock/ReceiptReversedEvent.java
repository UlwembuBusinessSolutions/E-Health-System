package co.ehealth.platform.pharmacy.stock;

import java.util.List;
import java.util.UUID;

// Published, inside the reversal transaction, when a receipt is cancelled and
// its stock leaves the shelf again. The mirror of StockIntakeEvent: the
// scheduled-medicines register listens so it never keeps stock the shelf lost.
public record ReceiptReversedEvent(UUID facilityId, UUID recordedBy, UUID ledgerTransactionId, String reason,
                                   List<StockIntakeEvent.IntakeLot> lots) {
}
