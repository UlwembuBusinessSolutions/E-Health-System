package co.ehealth.platform.pharmacy.stock;

import static co.ehealth.platform.pharmacy.stock.AdjustmentMode.ADD;
import static co.ehealth.platform.pharmacy.stock.AdjustmentMode.REMOVE;
import static co.ehealth.platform.pharmacy.stock.StockTransactionType.ADJUSTMENT_NEGATIVE;
import static co.ehealth.platform.pharmacy.stock.StockTransactionType.ADJUSTMENT_POSITIVE;
import static co.ehealth.platform.pharmacy.stock.StockTransactionType.WRITE_OFF;

// The fixed reasons a pharmacist can pick when correcting stock by hand
// (contract section 3). Each reason knows which direction it is valid for
// and which ledger movement type it posts as: stock that physically left
// the shelf (expired, damaged, recalled, lost) is a WRITE_OFF, while a
// plain data correction is an ADJUSTMENT so write-off reports stay honest.
public enum AdjustmentReason {
    EXPIRED(REMOVE, WRITE_OFF),
    DAMAGED(REMOVE, WRITE_OFF),
    RECALLED(REMOVE, WRITE_OFF),
    LOST_OR_STOLEN(REMOVE, WRITE_OFF),
    FOUND_IN_COUNT(ADD, ADJUSTMENT_POSITIVE),
    RETURNED_BY_PATIENT(ADD, ADJUSTMENT_POSITIVE),
    RETURNED_FROM_WARD(ADD, ADJUSTMENT_POSITIVE),
    WRONG_ENTRY(null, null),
    OTHER(null, null);

    private final AdjustmentMode fixedMode;
    private final StockTransactionType fixedType;

    AdjustmentReason(AdjustmentMode fixedMode, StockTransactionType fixedType) {
        this.fixedMode = fixedMode;
        this.fixedType = fixedType;
    }

    // WRONG_ENTRY and OTHER are valid in both directions.
    public boolean isAllowedFor(AdjustmentMode mode) {
        return fixedMode == null || fixedMode == mode;
    }

    public StockTransactionType transactionTypeFor(AdjustmentMode mode) {
        if (fixedType != null) {
            return fixedType;
        }
        return mode == ADD ? ADJUSTMENT_POSITIVE : ADJUSTMENT_NEGATIVE;
    }
}
