package co.ehealth.platform.pharmacy.openingstock;

import co.ehealth.platform.pharmacy.stock.PharmacyStockTransaction;
import co.ehealth.platform.pharmacy.stock.StockTransactionType;
import org.springframework.data.repository.Repository;

import java.util.UUID;

public interface OpeningStockLedgerRepository extends Repository<PharmacyStockTransaction, UUID> {

    boolean existsByFacilityIdAndType(UUID facilityId, StockTransactionType type);
}
