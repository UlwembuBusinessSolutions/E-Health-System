package co.ehealth.platform.pharmacy.openingstock;

import co.ehealth.platform.core.security.AuthenticatedPrincipal;
import co.ehealth.platform.core.tenant.ModuleCode;
import co.ehealth.platform.identity.PermissionLevel;
import co.ehealth.platform.identity.PermissionService;
import co.ehealth.platform.identity.User;
import co.ehealth.platform.identity.UserRepository;
import co.ehealth.platform.pharmacy.openingstock.OpeningStockRowValidator.RowCheck;
import co.ehealth.platform.pharmacy.stock.PharmacyProduct;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;
import java.util.stream.IntStream;

// Contract section 3 (B2): opening stock. Both calls need PHRM:MANAGE — the
// preview is only meaningful to someone allowed to post. Loading is allowed
// only while the facility has no opening balance (OpeningStockService).
@RestController
@RequestMapping("/api/v1/pharmacy/opening-stock")
public class OpeningStockController {

    static final int MAX_ROWS = 2000;

    private final OpeningStockService openingStockService;
    private final PermissionService permissionService;
    private final UserRepository userRepository;

    public OpeningStockController(OpeningStockService openingStockService, PermissionService permissionService,
                                  UserRepository userRepository) {
        this.openingStockService = openingStockService;
        this.permissionService = permissionService;
        this.userRepository = userRepository;
    }

    @PostMapping("/validate")
    public ResponseEntity<ValidationResponse> validate(@Valid @RequestBody OpeningStockRequest request) {
        permissionService.requireAccess(ModuleCode.PHRM, PermissionLevel.MANAGE);
        List<RowCheck> checks = openingStockService.validate(request.rows());
        return ResponseEntity.ok(ValidationResponse.from(checks));
    }

    @PostMapping
    public ResponseEntity<LoadedResponse> load(@Valid @RequestBody OpeningStockRequest request,
                                               @AuthenticationPrincipal AuthenticatedPrincipal principal) {
        permissionService.requireAccess(ModuleCode.PHRM, PermissionLevel.MANAGE);
        User actor = userRepository.findById(principal.userId()).orElseThrow();
        var result = openingStockService.post(request.facilityId(), request.rows(), actor.getId(),
                actor.getFirstName() + " " + actor.getLastName());
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(new LoadedResponse(result.transactionId(), result.rowsLoaded(), result.totalUnits()));
    }

    public record OpeningStockRequest(@NotNull UUID facilityId,
                                      @NotEmpty @Size(max = MAX_ROWS) List<OpeningStockRow> rows) {
    }

    public record ProductSummary(UUID id, String code, String name) {
        static ProductSummary from(PharmacyProduct product) {
            return product == null ? null
                    : new ProductSummary(product.getId(), product.getCode(), product.getDisplayName());
        }
    }

    public record RowResult(int rowNumber, OpeningRowStatus status, String hint, ProductSummary product) {
    }

    public record ValidationResponse(List<RowResult> rows, boolean allOk) {
        static ValidationResponse from(List<RowCheck> checks) {
            List<RowResult> rows = IntStream.range(0, checks.size())
                    .mapToObj(index -> new RowResult(index + 1, checks.get(index).status(), checks.get(index).hint(),
                            ProductSummary.from(checks.get(index).product())))
                    .toList();
            return new ValidationResponse(rows, checks.stream().allMatch(RowCheck::isOk));
        }
    }

    public record LoadedResponse(UUID transactionId, int rowsLoaded, long totalUnits) {
    }
}
