package co.ehealth.platform.pharmacy.stock;

import co.ehealth.platform.core.security.AuthenticatedPrincipal;
import co.ehealth.platform.core.tenant.ModuleCode;
import co.ehealth.platform.identity.PermissionLevel;
import co.ehealth.platform.identity.PermissionService;
import co.ehealth.platform.identity.User;
import co.ehealth.platform.identity.UserRepository;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import org.springframework.data.domain.Page;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

// Plan section 15's product endpoints. PHRM:VIEW covers search/read;
// PHRM:MANAGE covers create/update/archive/reactivate — the plan proposes
// finer PRODUCT_MANAGE/STOCK_VIEW capabilities (section 10), but this
// codebase's PermissionLevel is a fixed two-tier VIEW/MANAGE by design
// (PermissionService's own why-note) with no per-action grain; reusing it
// here rather than building a parallel capability system is a deliberate
// Phase 1 simplification, documented in pharmacy-stock-ledger-context.md.
@RestController
@RequestMapping("/api/v1/pharmacy/products")
public class PharmacyProductController {

    private final PharmacyProductService productService;
    private final PermissionService permissionService;
    private final UserRepository userRepository;

    public PharmacyProductController(PharmacyProductService productService, PermissionService permissionService,
                                      UserRepository userRepository) {
        this.productService = productService;
        this.permissionService = permissionService;
        this.userRepository = userRepository;
    }

    @GetMapping
    public ResponseEntity<Map<String, Object>> search(@RequestParam(required = false) String q,
                                                        @RequestParam(required = false, defaultValue = "true") boolean activeOnly,
                                                        @RequestParam(required = false, defaultValue = "0") int page,
                                                        @RequestParam(required = false, defaultValue = "50") int size) {
        permissionService.requireAccess(ModuleCode.PHRM, PermissionLevel.VIEW);
        Page<PharmacyProduct> result = productService.search(q, activeOnly, page, size);
        return ResponseEntity.ok(Map.of(
                "items", result.getContent().stream().map(ProductResponse::from).toList(),
                "page", result.getNumber(), "size", result.getSize(), "totalItems", result.getTotalElements(),
                "hasMore", result.hasNext()));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ProductResponse> get(@PathVariable UUID id) {
        permissionService.requireAccess(ModuleCode.PHRM, PermissionLevel.VIEW);
        return ResponseEntity.ok(ProductResponse.from(productService.get(id)));
    }

    @PostMapping
    public ResponseEntity<ProductResponse> create(@jakarta.validation.Valid @RequestBody CreateProductRequest request,
                                                   @AuthenticationPrincipal AuthenticatedPrincipal principal) {
        permissionService.requireAccess(ModuleCode.PHRM, PermissionLevel.MANAGE);
        User actor = currentUser(principal);
        PharmacyProduct product = productService.create(request.code(), request.displayName(),
                request.genericName(), request.strength(), request.dosageForm(), request.category(),
                request.baseUnit(), request.packSize(), request.barcode(), request.manufacturer(),
                request.batchTracked(), request.expiryTracked(), request.storageInstructions(),
                request.facilityId(), request.reorderThreshold(), request.targetQuantity(), actor.getId(),
                actorName(actor));
        return ResponseEntity.status(HttpStatus.CREATED).body(ProductResponse.from(product));
    }

    @PatchMapping("/{id}")
    public ResponseEntity<ProductResponse> update(@PathVariable UUID id,
                                                   @jakarta.validation.Valid @RequestBody UpdateProductRequest request,
                                                   @AuthenticationPrincipal AuthenticatedPrincipal principal) {
        permissionService.requireAccess(ModuleCode.PHRM, PermissionLevel.MANAGE);
        User actor = currentUser(principal);
        PharmacyProduct product = productService.updateDetails(id, request.displayName(), request.genericName(),
                request.strength(), request.dosageForm(), request.packSize(), request.barcode(),
                request.manufacturer(), request.storageInstructions(), actor.getId(), actorName(actor));
        return ResponseEntity.ok(ProductResponse.from(product));
    }

    @PostMapping("/{id}/archive")
    public ResponseEntity<ProductResponse> archive(@PathVariable UUID id,
                                                    @AuthenticationPrincipal AuthenticatedPrincipal principal) {
        permissionService.requireAccess(ModuleCode.PHRM, PermissionLevel.MANAGE);
        User actor = currentUser(principal);
        return ResponseEntity.ok(ProductResponse.from(productService.archive(id, actor.getId(), actorName(actor))));
    }

    @PostMapping("/{id}/reactivate")
    public ResponseEntity<ProductResponse> reactivate(@PathVariable UUID id,
                                                       @AuthenticationPrincipal AuthenticatedPrincipal principal) {
        permissionService.requireAccess(ModuleCode.PHRM, PermissionLevel.MANAGE);
        User actor = currentUser(principal);
        return ResponseEntity.ok(ProductResponse.from(productService.reactivate(id, actor.getId(), actorName(actor))));
    }

    private User currentUser(AuthenticatedPrincipal principal) {
        return userRepository.findById(principal.userId()).orElseThrow();
    }

    private static String actorName(User user) {
        return user.getFirstName() + " " + user.getLastName();
    }

    public record CreateProductRequest(
            @NotBlank String code, @NotBlank String displayName, String genericName, String strength,
            String dosageForm, @NotNull StockCategory category, @NotNull StockBaseUnit baseUnit, Integer packSize,
            String barcode, String manufacturer, boolean batchTracked, boolean expiryTracked,
            String storageInstructions, @NotNull UUID facilityId, Integer reorderThreshold,
            Integer targetQuantity) {
    }

    public record UpdateProductRequest(@NotBlank String displayName, String genericName, String strength,
                                        String dosageForm, Integer packSize, String barcode, String manufacturer,
                                        String storageInstructions) {
    }

    public record ProductResponse(UUID id, String code, String displayName, String genericName, String strength,
                                   String dosageForm, StockCategory category, StockBaseUnit baseUnit,
                                   Integer packSize, String barcode, String manufacturer, boolean batchTracked,
                                   boolean expiryTracked, String storageInstructions, boolean active,
                                   String createdByName, Instant createdAt, String updatedByName, Instant updatedAt) {
        static ProductResponse from(PharmacyProduct p) {
            return new ProductResponse(p.getId(), p.getCode(), p.getDisplayName(), p.getGenericName(),
                    p.getStrength(), p.getDosageForm(), p.getCategory(), p.getBaseUnit(), p.getPackSize(),
                    p.getBarcode(), p.getManufacturer(), p.isBatchTracked(), p.isExpiryTracked(),
                    p.getStorageInstructions(), p.isActive(), p.getCreatedByName(), p.getCreatedAt(),
                    p.getUpdatedByName(), p.getUpdatedAt());
        }
    }
}
