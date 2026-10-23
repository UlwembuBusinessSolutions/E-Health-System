package co.ehealth.platform.pharmacy.stock;

import jakarta.persistence.EntityManager;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

/** Persistently updates LOW/OUT alerts in the same transaction as each ledger movement. */
@Service
public class ReorderAlertService {
    private final EntityManager em;

    public ReorderAlertService(EntityManager em) { this.em = em; }

    @Transactional
    public void refresh(UUID facilityId, List<UUID> productIds) {
        // Flush any pending balance or assortment edits so the aggregation sees current values.
        em.flush();
        for (UUID productId : productIds.stream().distinct().sorted().toList()) {
            // Serialize alert reconciliation for a facility/product even when simultaneous
            // dispensing and receiving touch different batch rows.
            em.createNativeQuery("SELECT pg_advisory_xact_lock(hashtextextended(:lockKey, 0))")
                    .setParameter("lockKey", facilityId.toString() + ":" + productId).getSingleResult();
            // Including products with zero accounts ensures OUT is raised at a configured threshold.
            em.createNativeQuery("""
                    INSERT INTO pharmacy_reorder_alerts
                      (facility_id, product_id, status, quantity, reorder_threshold, first_raised_at,
                       last_updated_at, resolved_at)
                    SELECT :facilityId, fp.product_id,
                           CASE WHEN COALESCE(SUM(a.quantity),0) = 0 THEN 'OUT'
                                WHEN COALESCE(SUM(a.quantity),0) <= fp.reorder_threshold THEN 'LOW'
                                ELSE 'RESOLVED' END,
                           COALESCE(SUM(a.quantity),0), fp.reorder_threshold, now(), now(),
                           CASE WHEN COALESCE(SUM(a.quantity),0) > fp.reorder_threshold THEN now() ELSE NULL END
                    FROM pharmacy_facility_products fp
                    JOIN pharmacy_products p ON p.id = fp.product_id AND p.active
                    LEFT JOIN pharmacy_stock_locations l ON l.facility_id = fp.facility_id
                    LEFT JOIN pharmacy_stock_accounts a ON a.location_id = l.id AND a.product_id = fp.product_id
                         AND a.bucket = 'AVAILABLE'
                    WHERE fp.facility_id = :facilityId AND fp.product_id = :productId
                      AND fp.active AND fp.reorder_threshold IS NOT NULL
                    GROUP BY fp.product_id, fp.reorder_threshold
                    ON CONFLICT(facility_id, product_id) DO UPDATE SET
                      status = EXCLUDED.status, quantity = EXCLUDED.quantity,
                      reorder_threshold = EXCLUDED.reorder_threshold,
                      last_updated_at = CASE WHEN pharmacy_reorder_alerts.status <> EXCLUDED.status
                          OR pharmacy_reorder_alerts.quantity <> EXCLUDED.quantity
                          OR pharmacy_reorder_alerts.reorder_threshold <> EXCLUDED.reorder_threshold
                          THEN now() ELSE pharmacy_reorder_alerts.last_updated_at END,
                      first_raised_at = CASE WHEN pharmacy_reorder_alerts.status = 'RESOLVED'
                          AND EXCLUDED.status <> 'RESOLVED' THEN now()
                          ELSE pharmacy_reorder_alerts.first_raised_at END,
                      resolved_at = EXCLUDED.resolved_at
                    """).setParameter("facilityId", facilityId).setParameter("productId", productId).executeUpdate();
            // Changing the assortment or archiving the product should resolve old alerts.
            em.createNativeQuery("""
                    UPDATE pharmacy_reorder_alerts r SET status = 'RESOLVED',
                        resolved_at = now(), last_updated_at = now()
                    WHERE r.facility_id = :facilityId AND r.product_id = :productId
                      AND r.status <> 'RESOLVED'
                      AND NOT EXISTS (SELECT 1 FROM pharmacy_facility_products fp
                          JOIN pharmacy_products p ON p.id = fp.product_id AND p.active
                          WHERE fp.facility_id = :facilityId AND fp.product_id = :productId
                            AND fp.active AND fp.reorder_threshold IS NOT NULL)
                    """).setParameter("facilityId", facilityId).setParameter("productId", productId).executeUpdate();
        }
    }
}
