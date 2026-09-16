package co.ehealth.platform.pharmacy;

public class PrescriptionOnHoldException extends RuntimeException {
    public PrescriptionOnHoldException() {
        super("This prescription is on hold while the prescriber responds to a pharmacy query.");
    }
}
