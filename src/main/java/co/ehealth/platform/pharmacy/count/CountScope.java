package co.ehealth.platform.pharmacy.count;

// What a count covers. AREA is matched against a product's storage
// instructions ("Fridge", "Shelf B") because stock locations are not yet
// managed per bin — see StockCountScopeResolver.
public enum CountScope {
    ALL, AREA, PRODUCT
}
