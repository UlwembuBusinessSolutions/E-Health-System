package co.ehealth.platform.pharmacy.reorder;

import co.ehealth.platform.core.tenant.ModuleCode;
import co.ehealth.platform.identity.PermissionLevel;
import co.ehealth.platform.identity.PermissionService;
import co.ehealth.platform.pharmacy.stock.PharmacyProduct;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Objects;
import java.util.UUID;
import java.util.stream.Collectors;
import java.util.stream.Stream;

// Contract section 3 (B2): GET /reorder. The contract names only supplierId;
// facilityId is also required because "on hand" only means something per facility.
@RestController
@RequestMapping("/api/v1/pharmacy/reorder")
public class ReorderController {

    private final ReorderService reorderService;
    private final PermissionService permissionService;

    public ReorderController(ReorderService reorderService, PermissionService permissionService) {
        this.reorderService = reorderService;
        this.permissionService = permissionService;
    }

    @GetMapping
    public ResponseEntity<ReorderResponse> get(@RequestParam UUID supplierId, @RequestParam UUID facilityId) {
        permissionService.requireAccess(ModuleCode.PHRM, PermissionLevel.VIEW);
        return ResponseEntity.ok(ReorderResponse.from(reorderService.buildSheet(supplierId, facilityId)));
    }

    public record SupplierSummary(UUID id, String name) {
    }

    public record ReorderLineResponse(UUID productId, String name, String sub, Integer packSize, long onHand,
                                      Integer reorderThreshold, Integer targetQuantity, int suggestedQuantity,
                                      ReorderStatus status) {
        static ReorderLineResponse from(ReorderService.ReorderLine line) {
            PharmacyProduct product = line.product();
            return new ReorderLineResponse(product.getId(), product.getDisplayName(), subtitleOf(product),
                    product.getPackSize(), line.onHand(), line.reorderThreshold(), line.targetQuantity(),
                    line.suggestedQuantity(), line.status());
        }

        // "500 mg tablet" under the product name, built from whatever is on file.
        private static String subtitleOf(PharmacyProduct product) {
            return Stream.of(product.getStrength(), product.getDosageForm())
                    .filter(Objects::nonNull).filter(part -> !part.isBlank())
                    .collect(Collectors.joining(" "));
        }
    }

    public record ReorderResponse(SupplierSummary supplier, List<ReorderLineResponse> lines) {
        static ReorderResponse from(ReorderService.ReorderSheet sheet) {
            return new ReorderResponse(new SupplierSummary(sheet.supplier().getId(), sheet.supplier().getName()),
                    sheet.lines().stream().map(ReorderLineResponse::from).toList());
        }
    }
}
