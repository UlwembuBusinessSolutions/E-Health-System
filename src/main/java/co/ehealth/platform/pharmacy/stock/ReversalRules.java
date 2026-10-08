package co.ehealth.platform.pharmacy.stock;

import java.util.Set;

import static co.ehealth.platform.pharmacy.stock.StockTransactionType.ADJUSTMENT_NEGATIVE;
import static co.ehealth.platform.pharmacy.stock.StockTransactionType.ADJUSTMENT_POSITIVE;
import static co.ehealth.platform.pharmacy.stock.StockTransactionType.DISPENSE;
import static co.ehealth.platform.pharmacy.stock.StockTransactionType.OPENING_BALANCE;
import static co.ehealth.platform.pharmacy.stock.StockTransactionType.RECEIPT;
import static co.ehealth.platform.pharmacy.stock.StockTransactionType.TRANSFER_DISPATCH;
import static co.ehealth.platform.pharmacy.stock.StockTransactionType.WRITE_OFF;

// When a posted movement may be undone. Pure rules, no repositories, so the
// "already used" decision is testable on its own.
final class ReversalRules {

    // Dispensing has its own return flow, a reversal of a reversal would
    // hide the audit trail, and holds/transfers are not built yet.
    static final Set<StockTransactionType> REVERSIBLE_TYPES = Set.of(RECEIPT, OPENING_BALANCE, ADJUSTMENT_POSITIVE,
            ADJUSTMENT_NEGATIVE, WRITE_OFF);

    // Movements that take stock out of a lot. If any of them happened after
    // the stock arrived, it has been used and can't simply be taken back.
    static final Set<StockTransactionType> STOCK_OUTFLOW_TYPES = Set.of(DISPENSE, WRITE_OFF, ADJUSTMENT_NEGATIVE,
            TRANSFER_DISPATCH);

    private ReversalRules() {
    }

    static void requireReversible(StockTransactionType type) {
        if (!REVERSIBLE_TYPES.contains(type)) {
            throw new InvalidStockRequestException("A " + type.name().toLowerCase().replace('_', ' ')
                    + " movement can't be reversed here.");
        }
    }

    static void requireNoteWhenOther(ReversalReason reason, String note) {
        AdjustmentRules.requireNoteWhenOther(reason == ReversalReason.OTHER, note);
    }

    // Undoing a movement that added stock takes that stock away again. It is
    // "used" when the lot no longer holds that much, or when any outflow has
    // been posted against the lot since — even if a later receipt refilled it
    // enough to hide the shortfall, those units were not the ones received.
    static boolean isStockUsed(long originalDelta, long currentLotBalance, boolean outflowSinceThen) {
        boolean originalAddedStock = originalDelta > 0;
        return originalAddedStock && (currentLotBalance < originalDelta || outflowSinceThen);
    }
}
