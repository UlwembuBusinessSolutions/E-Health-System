package co.ehealth.platform.visit;

public class InvalidQueueReasonException extends RuntimeException {
    public InvalidQueueReasonException() {
        super("Select a reason; Other requires an explanation");
    }
}
