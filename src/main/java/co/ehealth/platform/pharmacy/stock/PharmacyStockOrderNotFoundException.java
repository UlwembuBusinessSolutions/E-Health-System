package co.ehealth.platform.pharmacy.stock;

import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

public class PharmacyStockOrderNotFoundException extends ResponseStatusException {
    public PharmacyStockOrderNotFoundException() {
        super(HttpStatus.NOT_FOUND, "Stock order not found.");
    }
}