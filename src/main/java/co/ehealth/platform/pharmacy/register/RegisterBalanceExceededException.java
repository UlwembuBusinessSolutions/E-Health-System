package co.ehealth.platform.pharmacy.register;

public class RegisterBalanceExceededException extends RuntimeException {
    public RegisterBalanceExceededException(long balance) {
        super("The register only holds " + balance + " of this medicine, so that quantity cannot be taken out.");
    }
}
