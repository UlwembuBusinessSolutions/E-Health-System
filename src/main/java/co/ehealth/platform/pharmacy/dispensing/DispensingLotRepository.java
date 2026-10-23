package co.ehealth.platform.pharmacy.dispensing;

import co.ehealth.platform.pharmacy.stock.PharmacyStockAccount;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

// Read-only lot balances for dispensing, fetched for many facilities and
// products in ONE query so a whole queue page never costs one lookup per
// item. Kept here, not in the stock package's repositories, because the
// shape (lot + expiry + location, AVAILABLE bucket only) is dispensing's own.
public interface DispensingLotRepository extends Repository<PharmacyStockAccount, UUID> {

    @Query("SELECT new co.ehealth.platform.pharmacy.dispensing.LotAvailability(l.facilityId, a.productId, b.id, "
            + "l.id, b.lotNumber, b.expiryDate, a.quantity) "
            + "FROM PharmacyStockAccount a, PharmacyBatch b, PharmacyStockLocation l "
            + "WHERE a.batchId = b.id AND a.locationId = l.id AND a.quantity > 0 "
            + "AND a.bucket = co.ehealth.platform.pharmacy.stock.StockBucket.AVAILABLE "
            + "AND l.facilityId IN :facilityIds AND a.productId IN :productIds")
    List<LotAvailability> findAvailableLots(@Param("facilityIds") Collection<UUID> facilityIds,
                                            @Param("productIds") Collection<UUID> productIds);
}
