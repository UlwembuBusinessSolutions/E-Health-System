package co.ehealth.platform.pharmacy;

public class PrescriptionNotFoundException extends RuntimeException {
    public PrescriptionNotFoundException() {
        super("Unknown prescription");
    }
}
