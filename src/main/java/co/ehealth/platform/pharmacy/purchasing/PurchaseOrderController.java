package co.ehealth.platform.pharmacy.purchasing;

import co.ehealth.platform.core.security.AuthenticatedPrincipal;
import co.ehealth.platform.core.tenant.ModuleCode;
import co.ehealth.platform.identity.PermissionLevel;
import co.ehealth.platform.identity.PermissionService;
import co.ehealth.platform.identity.User;
import co.ehealth.platform.identity.UserRepository;
import co.ehealth.platform.pharmacy.stock.PagedResponse;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

// Purchase orders. PHRM:VIEW reads, PHRM:MANAGE raises an order — the same
// two-tier split as the other pharmacy controllers.
@RestController
@RequestMapping("/api/v1/pharmacy/purchase-orders")
public class PurchaseOrderController {

    private final PurchaseOrderService orderService;
    private final PurchaseOrderQueryService queryService;
    private final PermissionService permissionService;
    private final UserRepository userRepository;

    public PurchaseOrderController(PurchaseOrderService orderService, PurchaseOrderQueryService queryService,
                                   PermissionService permissionService, UserRepository userRepository) {
        this.orderService = orderService;
        this.queryService = queryService;
        this.permissionService = permissionService;
        this.userRepository = userRepository;
    }

    @PostMapping
    public ResponseEntity<PurchaseOrderResponse> create(@Valid @RequestBody CreateOrderRequest request,
                                                        @AuthenticationPrincipal AuthenticatedPrincipal principal) {
        permissionService.requireAccess(ModuleCode.PHRM, PermissionLevel.MANAGE);
        User actor = userRepository.findById(principal.userId()).orElseThrow();
        PurchaseOrder order = orderService.create(request.toCommand(), actor.getId(),
                actor.getFirstName() + " " + actor.getLastName());
        return ResponseEntity.status(HttpStatus.CREATED).body(queryService.detail(order.getId()));
    }

    @GetMapping
    public PagedResponse<PurchaseOrderResponse> list(@RequestParam UUID facilityId,
                                                     @RequestParam(required = false) UUID supplierId,
                                                     @RequestParam(defaultValue = "0") int page,
                                                     @RequestParam(defaultValue = "50") int size) {
        permissionService.requireAccess(ModuleCode.PHRM, PermissionLevel.VIEW);
        return queryService.list(facilityId, supplierId, page, size);
    }

    public record CreateOrderRequest(@NotNull UUID facilityId, @NotNull UUID supplierId,
                                     @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate expectedDelivery,
                                     @NotEmpty List<@Valid LineRequest> lines) {

        PurchaseOrderService.CreateCommand toCommand() {
            return new PurchaseOrderService.CreateCommand(facilityId, supplierId, expectedDelivery,
                    lines.stream()
                            .map(line -> new PurchaseOrderService.LineCommand(line.productId(), line.packs(),
                                    line.packSize(), line.quantity()))
                            .toList());
        }
    }

    public record LineRequest(@NotNull UUID productId, @Min(1) int packs, @Min(1) int packSize, int quantity) {
    }
}
