package co.ehealth.platform.pharmacy.csvimport;

// Why a row cannot be imported yet. The hint next to each problem carries the
// plain-language explanation; this is the stable code the screen switches on.
public enum ImportProblem {
    MISSING_SKU,
    UNKNOWN_SKU,
    SIMILAR_SKU,
    MISSING_NAME,
    ALREADY_IN_CATALOGUE,
    ARCHIVED_PRODUCT,
    SERIAL_PRODUCT,
    COLD_CHAIN_PRODUCT,
    BAD_CATEGORY,
    BAD_UNIT,
    BAD_PACK_SIZE,
    BAD_SCHEDULE,
    BAD_QUANTITY,
    MISSING_LOT,
    BAD_EXPIRY,
    EXPIRED,
    DUPLICATE_LOT,
    LOT_EXPIRY_MISMATCH,
    UNKNOWN_SUPPLIER,
    SIMILAR_SUPPLIER
}
