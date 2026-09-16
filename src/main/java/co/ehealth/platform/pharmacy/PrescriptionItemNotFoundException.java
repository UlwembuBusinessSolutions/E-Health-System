package co.ehealth.platform.pharmacy;

public class PrescriptionItemNotFoundException extends RuntimeException {
    public PrescriptionItemNotFoundException() {
        super("Unknown prescription item.");
    }
}
