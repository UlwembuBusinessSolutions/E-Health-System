package co.ehealth.platform.pharmacy.serial;

public class SerialNotInStockException extends RuntimeException {
    public SerialNotInStockException(String serialNumber) {
        super("Serial number \"" + serialNumber + "\" is not in stock for this product, so it can't be removed.");
    }
}
