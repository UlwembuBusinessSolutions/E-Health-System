package co.ehealth.platform.pharmacy.stock;

// A stock command or filter that is well-formed JSON but breaks a business
// rule the pharmacist can fix — wrong reason for the direction, missing
// note, a quantity above the lot balance. Always carries a plain-language
// message; GlobalExceptionHandler maps it to 422.
public class InvalidStockRequestException extends RuntimeException {
    public InvalidStockRequestException(String message) {
        super(message);
    }
}
