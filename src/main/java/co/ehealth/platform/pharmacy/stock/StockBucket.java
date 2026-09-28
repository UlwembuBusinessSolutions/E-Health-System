package co.ehealth.platform.pharmacy.stock;

// Plan section 5/7 — physical stock is split across buckets that never
// double-count each other. Phase 1 only ever posts AVAILABLE; HELD exists
// now so Phase 2's hold/release movements (paired decrease/increase
// between buckets, section 7) are an additive value here, not a schema
// change to pharmacy_stock_accounts.bucket.
public enum StockBucket {
    AVAILABLE, HELD
}
