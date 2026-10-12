package co.ehealth.platform.pharmacy.prescribing;

import co.ehealth.platform.core.tenant.ModuleCode;
import co.ehealth.platform.identity.PermissionLevel;
import co.ehealth.platform.identity.PermissionService;
import co.ehealth.platform.pharmacy.prescribing.PrescribingStockService.SearchResult;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

// What the prescriber's medicine picker reads: the pharmacy's products with
// how much of each can be handed over right now. Read-only, so PHRM:VIEW is
// enough; the stock check that actually protects the prescription runs again
// on the server when it is signed.
@RestController
@RequestMapping("/api/v1/prescribing")
public class PrescribingController {

    private final PrescribingStockService stockService;
    private final PermissionService permissionService;

    public PrescribingController(PrescribingStockService stockService, PermissionService permissionService) {
        this.stockService = stockService;
        this.permissionService = permissionService;
    }

    @GetMapping("/medicines")
    public ResponseEntity<SearchResult> search(@RequestParam(required = false, defaultValue = "") String q) {
        permissionService.requireAccess(ModuleCode.PHRM, PermissionLevel.VIEW);
        return ResponseEntity.ok(stockService.search(q));
    }
}
