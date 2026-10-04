package co.ehealth.platform.pharmacy.dispensing;

// A prescription line is free text until a pharmacist picks the stock
// product behind it; stock is never deducted from a guessed product.
public class ProductNotMappedException extends DispensingValidationException {
    public ProductNotMappedException(String drugName) {
        super("Choose the product to dispense from for \"" + drugName + "\" before dispensing it.");
    }
}
