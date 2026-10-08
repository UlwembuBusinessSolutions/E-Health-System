package co.ehealth.platform.pharmacy.dispensing;

public class CollectionProofNotFoundException extends RuntimeException {
    public CollectionProofNotFoundException() {
        super("That proof document could not be found.");
    }
}
