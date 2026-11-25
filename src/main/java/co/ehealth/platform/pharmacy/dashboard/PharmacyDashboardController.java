package co.ehealth.platform.pharmacy.dashboard;

import co.ehealth.platform.core.tenant.ModuleCode;
import co.ehealth.platform.identity.PermissionLevel;
import co.ehealth.platform.identity.PermissionService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/pharmacy/dashboard")
public class PharmacyDashboardController {

    private final PharmacyDashboardService dashboardService;
    private final PharmacyDashboardScope dashboardScope;
    private final PermissionService permissionService;

    public PharmacyDashboardController(PharmacyDashboardService dashboardService,
                                       PharmacyDashboardScope dashboardScope,
                                       PermissionService permissionService) {
        this.dashboardService = dashboardService;
        this.dashboardScope = dashboardScope;
        this.permissionService = permissionService;
    }

    @GetMapping("/clinics")
    public Map<String, Object> clinics() {
        permissionService.requireAccess(ModuleCode.PHRM, PermissionLevel.VIEW);
        return Map.of("items", dashboardScope.clinics());
    }

    @GetMapping("/monthly-movements")
    public Map<String, Object> monthlyMovements(@RequestParam UUID facilityId) {
        permissionService.requireAccess(ModuleCode.PHRM, PermissionLevel.VIEW);
        dashboardScope.requireFacility(facilityId);
        return Map.of("items", dashboardService.monthlyMovements(facilityId));
    }
}
