package co.ehealth.platform.visit;

/**
 * Thrown when ticket generation fails (token not found, invalid status, etc.)
 */
public class TicketGenerationException extends RuntimeException {
    public TicketGenerationException(String message) {
        super(message);
    }

    public TicketGenerationException(String message, Throwable cause) {
        super(message, cause);
    }
}
