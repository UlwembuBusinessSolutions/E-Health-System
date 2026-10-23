package co.ehealth.platform.pharmacy.stock;

import co.ehealth.platform.core.tenant.ModuleCode;
import co.ehealth.platform.identity.PermissionLevel;
import co.ehealth.platform.identity.PermissionService;
import jakarta.persistence.EntityManager;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/** Facility-scoped persisted shortage alerts, separate from the existing live LOW/OUT worklist. */
@RestController
@RequestMapping("/api/v1/pharmacy/reorder-alerts")
public class ReorderAlertController {
    private final EntityManager em;
    private final PermissionService permissions;

    public ReorderAlertController(EntityManager em, PermissionService permissions) {
        this.em = em;
        this.permissions = permissions;
    }

    public record Alert(UUID productId, String productName, String status, long available,
                        int reorderThreshold, Instant firstRaisedAt, Instant lastUpdatedAt) { }

    @GetMapping
    public List<Alert> list(@RequestParam UUID facilityId) {
        permissions.requireAccess(ModuleCode.PHRM, PermissionLevel.VIEW);
        @SuppressWarnings("unchecked")
        List<Object[]> rows = em.createNativeQuery("""
                SELECT r.product_id, p.display_name, r.status, r.quantity, r.reorder_threshold,
                       r.first_raised_at, r.last_updated_at
                  FROM pharmacy_reorder_alerts r
                  JOIN pharmacy_products p ON p.id = r.product_id
                 WHERE r.facility_id = :facilityId AND r.status <> 'RESOLVED'
                 ORDER BY CASE r.status WHEN 'OUT' THEN 0 ELSE 1 END, p.display_name
                """).setParameter("facilityId", facilityId).getResultList();
        return rows.stream().map(row -> new Alert((UUID) row[0], (String) row[1], (String) row[2],
                ((Number) row[3]).longValue(), ((Number) row[4]).intValue(),
                toInstant(row[5]), toInstant(row[6]))).toList();
    }

    private static Instant toInstant(Object value) {
        if (value instanceof Instant instant) return instant;
        if (value instanceof java.time.OffsetDateTime date) return date.toInstant();
        if (value instanceof java.sql.Timestamp timestamp) return timestamp.toInstant();
        throw new IllegalStateException("Unsupported timestamp type");
    }
}
