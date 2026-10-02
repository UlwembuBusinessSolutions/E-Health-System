package co.ehealth.platform.pharmacy.stock;

// PharmacyReceiptService — an archived product can't receive new stock;
// archiving is meant to prevent new use while keeping history (plan
// section 4).
public class ProductArchivedException extends RuntimeException {
    public ProductArchivedException() {
        super("This product is archived and can't receive new stock.");
    }
}
