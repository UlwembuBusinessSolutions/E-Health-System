package co.ehealth.platform.pharmacy.receiving;

import co.ehealth.platform.pharmacy.stock.PharmacyStockEntry;
import org.springframework.data.repository.Repository;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

// Read-only batched ledger lookups for receipt screens. Its own interface
// (rather than more methods on PharmacyStockEntryRepository) so the ledger
// query code stays one owner's file.
public interface ReceiptLedgerRepository extends Repository<PharmacyStockEntry, UUID> {

    List<PharmacyStockEntry> findByTransactionIdIn(Collection<UUID> transactionIds);

    List<PharmacyStockEntry> findByStockAccountIdInAndQuantityDeltaLessThan(Collection<UUID> stockAccountIds,
                                                                            long quantityDelta);
}
