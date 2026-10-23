package co.ehealth.platform.pharmacy.supplier;

import co.ehealth.platform.core.security.AuthenticatedPrincipal;
import co.ehealth.platform.core.tenant.ModuleCode;
import co.ehealth.platform.identity.PermissionLevel;
import co.ehealth.platform.identity.PermissionService;
import co.ehealth.platform.pharmacy.reorder.SupplierOrderSummaryService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import org.springframework.data.domain.Page;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

// Contract section 3 (B2): supplier directory. PHRM:VIEW reads, PHRM:MANAGE
// writes — the same two-tier simplification as the other pharmacy controllers.
@RestController
@RequestMapping("/api/v1/pharmacy/suppliers")
public class SupplierController {

    private final SupplierService supplierService;
    private final SupplierMergeService mergeService;
    private final SupplierProductLinkService productLinkService;
    private final SupplierOrderSummaryService orderSummaryService;
    private final PermissionService permissionService;

    public SupplierController(SupplierService supplierService, SupplierMergeService mergeService,
                              SupplierProductLinkService productLinkService,
                              SupplierOrderSummaryService orderSummaryService, PermissionService permissionService) {
        this.supplierService = supplierService;
        this.mergeService = mergeService;
        this.productLinkService = productLinkService;
        this.orderSummaryService = orderSummaryService;
        this.permissionService = permissionService;
    }

    // facilityId is optional: with it each supplier also carries what needs
    // ordering there and when it was last ordered from; without it those two
    // fields are null.
    @GetMapping
    public ResponseEntity<Map<String, Object>> list(@RequestParam(required = false) String q,
                                                    @RequestParam(required = false) SupplierStatus status,
                                                    @RequestParam(required = false) UUID facilityId,
                                                    @RequestParam(defaultValue = "0") int page,
                                                    @RequestParam(defaultValue = "50") int size) {
        permissionService.requireAccess(ModuleCode.PHRM, PermissionLevel.VIEW);
        Page<PharmacySupplier> result = supplierService.search(q, status, page, size);
        List<UUID> supplierIds = result.getContent().stream().map(PharmacySupplier::getId).toList();
        Map<UUID, Long> productCounts = supplierService.productCounts(supplierIds);
        Map<UUID, SupplierOrderSummaryService.OrderSummary> orderSummaries = facilityId == null ? Map.of()
                : orderSummaryService.summarise(facilityId, supplierIds);
        List<SupplierResponse> items = result.getContent().stream()
                .map(supplier -> SupplierResponse.from(supplier, productCounts.getOrDefault(supplier.getId(), 0L),
                        orderSummaries.get(supplier.getId())))
                .toList();
        return ResponseEntity.ok(Map.of("items", items, "page", result.getNumber(), "size", result.getSize(),
                "totalItems", result.getTotalElements(), "hasMore", result.hasNext()));
    }

    @PostMapping
    public ResponseEntity<SupplierResponse> create(@Valid @RequestBody CreateSupplierRequest request,
                                                   @AuthenticationPrincipal AuthenticatedPrincipal principal) {
        permissionService.requireAccess(ModuleCode.PHRM, PermissionLevel.MANAGE);
        PharmacySupplier supplier = supplierService.create(request.name(), request.phone(), request.email(),
                request.confirmDistinct(), principal.userId());
        return ResponseEntity.status(HttpStatus.CREATED).body(SupplierResponse.from(supplier, 0));
    }

    @PatchMapping("/{id}")
    public ResponseEntity<SupplierResponse> update(@PathVariable UUID id,
                                                   @Valid @RequestBody UpdateSupplierRequest request) {
        permissionService.requireAccess(ModuleCode.PHRM, PermissionLevel.MANAGE);
        PharmacySupplier supplier = supplierService.update(id, request.name(), request.phone(), request.email(),
                request.confirmDistinct());
        return ResponseEntity.ok(respond(supplier));
    }

    @PostMapping("/{id}/archive")
    public ResponseEntity<SupplierResponse> archive(@PathVariable UUID id) {
        permissionService.requireAccess(ModuleCode.PHRM, PermissionLevel.MANAGE);
        return ResponseEntity.ok(respond(supplierService.archive(id)));
    }

    @PostMapping("/{id}/reactivate")
    public ResponseEntity<SupplierResponse> reactivate(@PathVariable UUID id) {
        permissionService.requireAccess(ModuleCode.PHRM, PermissionLevel.MANAGE);
        return ResponseEntity.ok(respond(supplierService.reactivate(id)));
    }

    // Returns the surviving supplier so the client can refresh its row.
    @PostMapping("/{id}/merge")
    public ResponseEntity<SupplierResponse> merge(@PathVariable UUID id,
                                                  @Valid @RequestBody MergeSupplierRequest request) {
        permissionService.requireAccess(ModuleCode.PHRM, PermissionLevel.MANAGE);
        return ResponseEntity.ok(respond(mergeService.merge(id, request.intoSupplierId())));
    }

    @PutMapping("/{id}/products/{productId}")
    public ResponseEntity<Void> linkProduct(@PathVariable UUID id, @PathVariable UUID productId) {
        permissionService.requireAccess(ModuleCode.PHRM, PermissionLevel.MANAGE);
        productLinkService.link(id, productId);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/{id}/products/{productId}")
    public ResponseEntity<Void> unlinkProduct(@PathVariable UUID id, @PathVariable UUID productId) {
        permissionService.requireAccess(ModuleCode.PHRM, PermissionLevel.MANAGE);
        productLinkService.unlink(id, productId);
        return ResponseEntity.noContent().build();
    }

    private SupplierResponse respond(PharmacySupplier supplier) {
        long productCount = supplierService.productCounts(List.of(supplier.getId()))
                .getOrDefault(supplier.getId(), 0L);
        return SupplierResponse.from(supplier, productCount);
    }

    public record CreateSupplierRequest(@NotBlank String name, String phone, String email,
                                        boolean confirmDistinct) {
    }

    public record UpdateSupplierRequest(String name, String phone, String email, boolean confirmDistinct) {
    }

    public record MergeSupplierRequest(@NotNull UUID intoSupplierId) {
    }

    // toOrderCount and lastOrderedAt are only filled in on the facility-scoped
    // list; every other response leaves them null.
    public record SupplierResponse(UUID id, String name, String phone, String email, SupplierStatus status,
                                   UUID mergedIntoId, long productCount, Instant createdAt, Integer toOrderCount,
                                   Instant lastOrderedAt) {
        static SupplierResponse from(PharmacySupplier supplier, long productCount) {
            return from(supplier, productCount, null);
        }

        static SupplierResponse from(PharmacySupplier supplier, long productCount,
                                     SupplierOrderSummaryService.OrderSummary orderSummary) {
            return new SupplierResponse(supplier.getId(), supplier.getName(), supplier.getPhone(),
                    supplier.getEmail(), supplier.getStatus(), supplier.getMergedIntoId(), productCount,
                    supplier.getCreatedAt(), orderSummary == null ? null : orderSummary.toOrderCount(),
                    orderSummary == null ? null : orderSummary.lastOrderedAt());
        }
    }
}
