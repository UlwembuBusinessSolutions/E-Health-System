package co.ehealth.platform.pharmacy.stock;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface PharmacyStockAccountRepository extends JpaRepository<PharmacyStockAccount, UUID> {

    // Lazily creates the (product, batch, location, bucket) account row
    // the very first time it's touched, without racing a concurrent first-
    // touch: ON CONFLICT DO NOTHING against the unique key means two
    // simultaneous first receipts for the same never-before-stocked
    // product/batch/location don't both try to INSERT — Postgres blocks
    // the second insert attempt until the first commits, then it sees the
    // conflict and no-ops, and both callers proceed to findForUpdate()
    // below to actually lock the now-guaranteed-to-exist row. Always call
    // this immediately before findForUpdate(), never findForUpdate() alone
    // against an account that might not exist yet.
    @Modifying
    @Query(value = "INSERT INTO pharmacy_stock_accounts (product_id, batch_id, location_id, bucket, quantity) "
            + "VALUES (:productId, :batchId, :locationId, CAST(:bucket AS VARCHAR), 0) "
            + "ON CONFLICT (product_id, batch_id, location_id, bucket) DO NOTHING", nativeQuery = true)
    void ensureAccountExists(@Param("productId") UUID productId, @Param("batchId") UUID batchId,
                              @Param("locationId") UUID locationId, @Param("bucket") String bucket);

    // PESSIMISTIC_WRITE — plan section 7's posting sequence step 3: "Lock
    // affected stock accounts in a deterministic order; re-read balances
    // inside the transaction." PharmacyStockLedgerService.postEntries()
    // calls this once per affected account, always in a fixed sort order
    // (by account id) across every line of a posting, so two concurrent
    // postings touching an overlapping set of accounts can never deadlock
    // against each other — both always acquire locks in the same order.
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT a FROM PharmacyStockAccount a WHERE a.productId = :productId AND a.batchId = :batchId "
            + "AND a.locationId = :locationId AND a.bucket = :bucket")
    Optional<PharmacyStockAccount> findForUpdate(@Param("productId") UUID productId, @Param("batchId") UUID batchId,
                                                  @Param("locationId") UUID locationId,
                                                  @Param("bucket") StockBucket bucket);

    List<PharmacyStockAccount> findByProductIdAndLocationId(UUID productId, UUID locationId);

    // The facility-wide balance sweep behind GET /api/v1/pharmacy/stock —
    // joined through location to scope by facility, since a stock account
    // itself only knows its location, not the facility that owns it.
    @Query("SELECT a FROM PharmacyStockAccount a, PharmacyStockLocation l "
            + "WHERE a.locationId = l.id AND l.facilityId = :facilityId AND a.quantity > 0")
    List<PharmacyStockAccount> findPositiveByFacility(@Param("facilityId") UUID facilityId);

    List<PharmacyStockAccount> findByProductId(UUID productId);
}
