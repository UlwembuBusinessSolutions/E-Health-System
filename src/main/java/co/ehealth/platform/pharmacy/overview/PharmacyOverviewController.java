package co.ehealth.platform.pharmacy.overview;

import co.ehealth.platform.core.tenant.ModuleCode;
import co.ehealth.platform.identity.PermissionLevel;
import co.ehealth.platform.identity.PermissionService;
import co.ehealth.platform.pharmacy.dashboard.PharmacyDashboardScope;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

// GET /overview — everything the pharmacy Overview tab draws, in one call.
// PHRM:VIEW, like the Stock page it summarises.
@RestController
@RequestMapping("/api/v1/pharmacy")
public class PharmacyOverviewController {

    private final PharmacyOverviewService overviewService;
    private final PharmacyDashboardScope dashboardScope;
    private final PermissionService permissionService;

    public PharmacyOverviewController(PharmacyOverviewService overviewService, PharmacyDashboardScope dashboardScope,
                                      PermissionService permissionService) {
        this.overviewService = overviewService;
        this.dashboardScope = dashboardScope;
        this.permissionService = permissionService;
    }

    @GetMapping("/overview")
    public PharmacyOverviewService.Overview overview(@RequestParam UUID facilityId) {
        permissionService.requireAccess(ModuleCode.PHRM, PermissionLevel.VIEW);
        dashboardScope.requireFacility(facilityId);
        return overviewService.overview(facilityId);
    }
}
