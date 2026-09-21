package co.ehealth.platform.pharmacy.stock;

// PharmacyProductService.archive() — plan section 4: "Before archiving
// require no physical balance in any bucket, no in-transit stock and no
// unresolved mapped prescription obligation." Phase 1 only ever checks
// physical balance (holds/transfers/dispense mappings don't exist yet).
public class ProductHasStockException extends RuntimeException {
    public ProductHasStockException() {
        super("This product still has stock on hand. Remove or write off all stock before archiving.");
    }
}
