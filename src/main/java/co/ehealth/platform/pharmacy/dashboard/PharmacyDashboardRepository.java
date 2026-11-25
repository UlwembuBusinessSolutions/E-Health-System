package co.ehealth.platform.pharmacy.dashboard;

import co.ehealth.platform.pharmacy.stock.PharmacyStockTransaction;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public interface PharmacyDashboardRepository extends Repository<PharmacyStockTransaction, UUID> {

    @Query(value = "SELECT to_char(date_trunc('month', created_at AT TIME ZONE CAST(:zone AS TEXT)), 'YYYY-MM') "
            + "AS \"month\", COUNT(*) AS \"transactionCount\" "
            + "FROM pharmacy_stock_transactions WHERE facility_id = :facilityId "
            + "AND created_at >= :from AND created_at < :to "
            + "GROUP BY 1 ORDER BY 1", nativeQuery = true)
    List<MonthlyMovementView> monthlyMovements(@Param("facilityId") UUID facilityId, @Param("zone") String zone,
                                               @Param("from") Instant from, @Param("to") Instant to);

    interface MonthlyMovementView {
        String getMonth();

        long getTransactionCount();
    }
}
