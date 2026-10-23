package co.ehealth.platform.pharmacy.dispensing;

// Only the prescriber chooses medicines. A line the prescriber never matched to a
// stock product cannot be dispensed, and the pharmacist cannot pick one for it.
public class ProductNotMappedException extends DispensingValidationException {
    public ProductNotMappedException(String drugName) {
        super("The prescriber has not chosen a stock product for \"" + drugName
                + "\". Message the prescriber to correct the prescription before it is dispensed.");
    }
}
