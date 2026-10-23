package co.ehealth.platform.clinician;

import co.ehealth.platform.core.security.AuthenticatedPrincipal;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

// GET /dashboard — everything the clinician Dashboard draws for the signed-in
// staff member at one facility. RECQ:VIEW, checked in the service.
@RestController
@RequestMapping("/api/v1/clinician")
public class ClinicianDashboardController {

    private final ClinicianDashboardService dashboardService;

    public ClinicianDashboardController(ClinicianDashboardService dashboardService) {
        this.dashboardService = dashboardService;
    }

    @GetMapping("/dashboard")
    public ClinicianDashboardService.Dashboard dashboard(@RequestParam UUID facilityId,
                                                         @AuthenticationPrincipal AuthenticatedPrincipal staff) {
        return dashboardService.dashboard(facilityId, staff.userId());
    }
}
