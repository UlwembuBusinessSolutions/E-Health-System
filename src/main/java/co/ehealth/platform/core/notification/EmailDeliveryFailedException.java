package co.ehealth.platform.core.notification;

public class EmailDeliveryFailedException extends RuntimeException {
    public EmailDeliveryFailedException() {
        super("We couldn't deliver the verification email. Please try again later.");
    }
}
