package co.ehealth.platform.pharmacy.stock;

import co.ehealth.platform.core.security.AuthenticatedPrincipal;
import co.ehealth.platform.core.tenant.ModuleCode;
import co.ehealth.platform.identity.*;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import java.util.*;

@RestController
@RequestMapping("/api/v1/pharmacy/stock")
public class PharmacyStockControlController {
    private final PharmacyStockControlService service;
    private final PharmacyStockAccountRepository accounts;
    private final PharmacyBatchRepository batches;
    private final PharmacyStockQueryService query;
    private final PermissionService permissions;
    private final UserRepository users;

    public PharmacyStockControlController(PharmacyStockControlService service, PharmacyStockAccountRepository accounts,
            PharmacyBatchRepository batches, PharmacyStockQueryService query, PermissionService permissions, UserRepository users) {
        this.service = service; this.accounts = accounts; this.batches = batches;
        this.query = query; this.permissions = permissions; this.users = users;
    }

    @GetMapping("/accounts")
    public Map<String, Object> accounts(@RequestParam UUID facilityId, @RequestParam UUID productId) {
        permissions.requireAccess(ModuleCode.PHRM, PermissionLevel.VIEW);
        var items = accounts.findAtFacility(facilityId, productId).stream().map(a -> {
            var batch = batches.findById(a.getBatchId()).orElseThrow();
            return new AccountRow(a.getId(), a.getBatchId(), a.getLocationId(), batch.getLotNumber(),
                    a.getBucket().name(), a.getQuantity());
        }).toList();
        return Map.of("items", items);
    }

    @GetMapping("/alerts")
    public Map<String, Object> alerts(@RequestParam UUID facilityId) {
        permissions.requireAccess(ModuleCode.PHRM, PermissionLevel.VIEW);
        // Active alerts are a projection of committed balances: never stale, and automatically
        // resolved when a receipt/count restores stock above the configured reorder level.
        return Map.of("items", query.listFacilityBalances(facilityId).stream()
                .filter(b -> b.reorderThreshold() != null && b.available() <= b.reorderThreshold())
                .map(PharmacyStockController.StockRow::from).toList());
    }

    @PostMapping("/counts")
    public Map<String, UUID> count(@Valid @RequestBody CountRequest request,
            @RequestHeader("Idempotency-Key") UUID key, @AuthenticationPrincipal AuthenticatedPrincipal principal) {
        permissions.requireAccess(ModuleCode.PHRM, PermissionLevel.MANAGE);
        var actor = users.findById(principal.userId()).orElseThrow();
        var result = service.count(new PharmacyStockControlService.CountCommand(request.facilityId(), request.productId(),
                request.accountId(), request.expectedQuantity().longValueExact(), request.countedQuantity().longValueExact(), request.reason()), key,
                principal.userId(), actor.getFirstName() + " " + actor.getLastName());
        return Map.of("transactionId", result.getId());
    }

    @PatchMapping("/reorder-level")
    public void reorder(@Valid @RequestBody ReorderRequest request, @AuthenticationPrincipal AuthenticatedPrincipal principal) {
        permissions.requireAccess(ModuleCode.PHRM, PermissionLevel.MANAGE);
        service.updateReorderLevel(request.facilityId(), request.productId(),
                request.reorderThreshold() == null ? null : request.reorderThreshold().intValueExact(), principal.userId());
    }

    public record AccountRow(UUID accountId, UUID batchId, UUID locationId, String lotNumber, String bucket, long quantity) {}
    public record CountRequest(@NotNull UUID facilityId, @NotNull UUID productId, @NotNull UUID accountId,
            @NotNull @PositiveOrZero @Digits(integer = 19, fraction = 0) @DecimalMax("9223372036854775807") java.math.BigDecimal expectedQuantity,
            @NotNull @PositiveOrZero @Digits(integer = 19, fraction = 0) @DecimalMax("9223372036854775807") java.math.BigDecimal countedQuantity,
            @NotBlank @Size(max = 500) String reason) {}
    public record ReorderRequest(@NotNull UUID facilityId, @NotNull UUID productId,
            @PositiveOrZero @Digits(integer = 10, fraction = 0) @DecimalMax("2147483647") java.math.BigDecimal reorderThreshold) {}
}
