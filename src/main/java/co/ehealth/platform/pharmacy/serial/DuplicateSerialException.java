package co.ehealth.platform.pharmacy.serial;

public class DuplicateSerialException extends RuntimeException {
    public DuplicateSerialException(String serialNumber) {
        super("Serial number \"" + serialNumber + "\" is already registered for this product. "
                + "Check the label, or remove the earlier unit first if it has left the shelf.");
    }
}
