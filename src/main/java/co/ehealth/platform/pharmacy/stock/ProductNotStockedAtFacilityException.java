package co.ehealth.platform.pharmacy.stock;

// PharmacyReceiptService — receiving requires the product to already be in
// this facility's assortment (plan section 4). Add it to the assortment
// first, then receive.
public class ProductNotStockedAtFacilityException extends RuntimeException {
    public ProductNotStockedAtFacilityException() {
        super("This product isn't in this facility's assortment yet. Add it before receiving stock.");
    }
}
