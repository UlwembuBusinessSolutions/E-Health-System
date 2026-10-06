package co.ehealth.platform.pharmacy;

// PrescriptionService.dispense() called a second time against the same
// prescription — dispensing_records.prescription_id is UNIQUE at the
// database level too, but this is the clean 409 a client sees instead of a
// raw constraint-violation 500.
public class PrescriptionAlreadyDispensedException extends RuntimeException {
    public PrescriptionAlreadyDispensedException() {
        super("This prescription has already been dispensed.");
    }
}
