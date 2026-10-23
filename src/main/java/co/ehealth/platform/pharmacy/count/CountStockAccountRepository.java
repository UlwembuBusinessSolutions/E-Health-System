package co.ehealth.platform.pharmacy.count;

import co.ehealth.platform.pharmacy.stock.PharmacyStockAccount;
import co.ehealth.platform.pharmacy.stock.StockBucket;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

// Read-only views over the stock accounts that counting needs. Counting
// never changes a balance itself — every adjustment goes through
// PharmacyStockLedgerService — so this is deliberately a plain Repository
// with no save/delete.
public interface CountStockAccountRepository extends Repository<PharmacyStockAccount, UUID> {

    Optional<PharmacyStockAccount> findByProductIdAndBatchIdAndLocationIdAndBucket(UUID productId, UUID batchId,
                                                                                    UUID locationId,
                                                                                    StockBucket bucket);

    @Query("SELECT a FROM PharmacyStockAccount a WHERE a.locationId = :locationId AND a.bucket = :bucket "
            + "AND a.productId IN :productIds")
    List<PharmacyStockAccount> findForProducts(@Param("locationId") UUID locationId,
                                                @Param("bucket") StockBucket bucket,
                                                @Param("productIds") Collection<UUID> productIds);

    @Query("SELECT a FROM PharmacyStockAccount a WHERE a.locationId = :locationId AND a.bucket = :bucket "
            + "AND a.quantity > 0")
    List<PharmacyStockAccount> findStocked(@Param("locationId") UUID locationId,
                                            @Param("bucket") StockBucket bucket);

    @Query("SELECT a FROM PharmacyStockAccount a, PharmacyProduct p WHERE a.productId = p.id "
            + "AND a.locationId = :locationId AND a.bucket = :bucket AND a.quantity > 0 "
            + "AND (LOWER(p.displayName) LIKE LOWER(CONCAT('%', :text, '%')) "
            + "OR LOWER(p.code) LIKE LOWER(CONCAT('%', :text, '%')) "
            + "OR LOWER(COALESCE(p.genericName, '')) LIKE LOWER(CONCAT('%', :text, '%')) "
            + "OR LOWER(COALESCE(p.barcode, '')) LIKE LOWER(CONCAT('%', :text, '%')))")
    List<PharmacyStockAccount> findStockedMatchingProduct(@Param("locationId") UUID locationId,
                                                           @Param("bucket") StockBucket bucket,
                                                           @Param("text") String text);

    @Query("SELECT a FROM PharmacyStockAccount a, PharmacyProduct p WHERE a.productId = p.id "
            + "AND a.locationId = :locationId AND a.bucket = :bucket AND a.quantity > 0 "
            + "AND LOWER(COALESCE(p.storageInstructions, '')) LIKE LOWER(CONCAT('%', :area, '%'))")
    List<PharmacyStockAccount> findStockedInArea(@Param("locationId") UUID locationId,
                                                  @Param("bucket") StockBucket bucket,
                                                  @Param("area") String area);
}
