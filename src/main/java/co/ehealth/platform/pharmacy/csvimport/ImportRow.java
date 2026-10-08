package co.ehealth.platform.pharmacy.csvimport;

// One line of the import sheet exactly as the pharmacist typed or pasted it.
// Everything is text so a malformed date or quantity is reported against its
// row instead of failing the whole request. confirmNewProduct is a decision
// made on the check screen, not a column of the file.
public record ImportRow(String sku, String name, String category, String unit, String packSize, String schedule,
                        String lot, String expiry, String quantity, String supplier, String invoice,
                        boolean confirmNewProduct) {
}
