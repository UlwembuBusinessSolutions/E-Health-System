package co.ehealth.platform.pharmacy.csvimport;

// What importing a row would do: add a lot to a product that exists, create
// the product and add its first lot, or nothing until the row is fixed.
public enum ImportRowStatus {
    RESTOCK, NEW_PRODUCT, PROBLEM
}
