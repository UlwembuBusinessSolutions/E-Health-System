package co.ehealth.platform.pharmacy;

public class InvalidPrescriberDispenseException extends RuntimeException {
    public InvalidPrescriberDispenseException(String message) {
        super(message);
    }
}