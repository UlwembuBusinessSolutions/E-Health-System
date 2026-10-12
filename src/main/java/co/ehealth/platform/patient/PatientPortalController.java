package co.ehealth.platform.patient;

import co.ehealth.platform.core.security.PatientPrincipal;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Patient-only API. The resource is resolved from the authenticated account, never from a path parameter. */
@RestController
@RequestMapping("/api/v1/patient")
public class PatientPortalController {

    private final PatientPortalService portalService;

    public PatientPortalController(PatientPortalService portalService) {
        this.portalService = portalService;
    }

    @GetMapping("/records")
    public ResponseEntity<PatientPortalService.OwnRecords> ownRecords(
            @AuthenticationPrincipal PatientPrincipal principal) {
        return ResponseEntity.ok(portalService.getOwnRecords(principal));
    }
}
