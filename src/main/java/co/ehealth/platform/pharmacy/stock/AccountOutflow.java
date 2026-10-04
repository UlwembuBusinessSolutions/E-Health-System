package co.ehealth.platform.pharmacy.stock;

import java.util.UUID;

// The sequence number of the latest stock-outflow movement on one account.
// Public because Hibernate instantiates it from the constructor expression
// in PharmacyStockEntryRepository.findLatestOutflowByAccount().
public record AccountOutflow(UUID accountId, long latestSeq) {
}
