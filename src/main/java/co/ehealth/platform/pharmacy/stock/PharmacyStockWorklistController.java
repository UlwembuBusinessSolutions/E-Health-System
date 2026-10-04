package co.ehealth.platform.pharmacy.stock;

import co.ehealth.platform.core.tenant.ModuleCode;
import co.ehealth.platform.identity.PermissionLevel;
import co.ehealth.platform.identity.PermissionService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

// GET /stock (searchable, filterable, paged), GET /dashboard (the Stock page
// cards) and GET /expiry (expiry worklist). PHRM:VIEW covers all three.
@RestController
@RequestMapping("/api/v1/pharmacy")
public class PharmacyStockWorklistController {

    private final PharmacyStockWorklistService worklistService;
    private final PermissionService permissionService;

    public PharmacyStockWorklistController(PharmacyStockWorklistService worklistService,
                                           PermissionService permissionService) {
        this.worklistService = worklistService;
        this.permissionService = permissionService;
    }

    @GetMapping("/stock")
    public PagedResponse<StockRow> listStock(@RequestParam UUID facilityId,
                                             @RequestParam(required = false) String q,
                                             @RequestParam(required = false) String status,
                                             @RequestParam(defaultValue = "0") int page,
                                             @RequestParam(defaultValue = "50") int size) {
        permissionService.requireAccess(ModuleCode.PHRM, PermissionLevel.VIEW);
        return PagedResponse.of(worklistService.listStock(facilityId, q, StockStatusFilter.parse(status), page, size),
                StockRow::from);
    }

    @GetMapping("/dashboard")
    public PharmacyStockWorklistService.DashboardCounts dashboard(@RequestParam UUID facilityId) {
        permissionService.requireAccess(ModuleCode.PHRM, PermissionLevel.VIEW);
        return worklistService.dashboard(facilityId);
    }

    @GetMapping("/expiry")
    public PagedResponse<PharmacyStockWorklistService.ExpiryLotRow> listExpiry(
            @RequestParam UUID facilityId,
            @RequestParam(defaultValue = "" + PharmacyStockWorklistService.DEFAULT_EXPIRY_WINDOW_DAYS) int days,
            @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "50") int size) {
        permissionService.requireAccess(ModuleCode.PHRM, PermissionLevel.VIEW);
        return PagedResponse.of(worklistService.listExpiringLots(facilityId, days, page, size), row -> row);
    }

    // status keeps the display label the Stock page already shows.
    // serialTracked and schedule are fixed placeholders until the product
    // columns arrive with the suppliers/tracking migration (V42): the
    // integrator replaces them with the product's real values in the stock
    // list query.
    public record StockRow(UUID productId, String code, String displayName, StockBaseUnit baseUnit, long available,
                           Integer reorderThreshold, String status, String nextExpiry, boolean serialTracked,
                           String schedule, long lotCount, boolean archived) {
        static StockRow from(PharmacyStockWorklistService.StockListRow row) {
            return new StockRow(row.productId(), row.code(), row.displayName(), row.baseUnit(), row.available(),
                    row.reorderThreshold(), row.status().label(),
                    row.nextExpiry() == null ? null : row.nextExpiry().toString(), false, null, row.lotCount(),
                    row.archived());
        }
    }
}
