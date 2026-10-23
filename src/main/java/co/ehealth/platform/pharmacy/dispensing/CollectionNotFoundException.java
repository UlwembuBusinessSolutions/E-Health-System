package co.ehealth.platform.pharmacy.dispensing;

public class CollectionNotFoundException extends RuntimeException {
    public CollectionNotFoundException() {
        super("This prescription has not been collected yet.");
    }
}
