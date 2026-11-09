package co.ehealth.platform.visit;

import co.ehealth.platform.core.tenant.ModuleCode;
import co.ehealth.platform.identity.PermissionLevel;
import co.ehealth.platform.identity.PermissionService;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
public class VisitTimingController {
    private final VisitTimingService timing;
    private final PermissionService permissions;
    public VisitTimingController(VisitTimingService timing, PermissionService permissions) {
        this.timing = timing;
        this.permissions = permissions;
    }
    @GetMapping("/api/v1/visits/{visitId}/timing")
    public VisitTimingService.Snapshot get(@PathVariable UUID visitId) {
        permissions.requireAccess(ModuleCode.RECQ, PermissionLevel.VIEW);
        return timing.get(visitId);
    }
    @GetMapping("/api/v1/patients/{patientId}/visit-timings")
    public Map<String, List<VisitTimingService.Snapshot>> history(@PathVariable UUID patientId) {
        permissions.requireAccess(ModuleCode.RECQ, PermissionLevel.VIEW);
        return Map.of("items", timing.forPatient(patientId));
    }
}
