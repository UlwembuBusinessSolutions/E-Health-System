package co.ehealth.platform.pharmacy.stock;

// Plan section 4's product-field table — "Category: Medicine or supply,
// with configured subcategories." Subcategories aren't modeled yet (no
// approved subcategory list exists); this is the top-level split alone.
public enum StockCategory {
    MEDICINE, SUPPLY
}
