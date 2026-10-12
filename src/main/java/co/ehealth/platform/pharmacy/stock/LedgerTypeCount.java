package co.ehealth.platform.pharmacy.stock;

// One bucket of the ledger's type-chip counts. Public because Hibernate
// instantiates it from the constructor expression in
// PharmacyStockEntryRepository.countByType().
public record LedgerTypeCount(StockTransactionType type, long count) {
}
