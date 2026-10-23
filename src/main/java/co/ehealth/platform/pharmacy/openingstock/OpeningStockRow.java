package co.ehealth.platform.pharmacy.openingstock;

// One line of the opening-stock sheet exactly as the pharmacist typed or
// pasted it. Everything is text so a malformed date or quantity can be
// reported against its row instead of failing the whole request.
public record OpeningStockRow(String sku, String lot, String expiry, String quantity) {
}
