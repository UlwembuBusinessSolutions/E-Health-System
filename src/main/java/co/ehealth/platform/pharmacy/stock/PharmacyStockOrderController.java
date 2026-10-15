package co.ehealth.platform.pharmacy.stock;

import co.ehealth.platform.core.security.AuthenticatedPrincipal;
import co.ehealth.platform.core.tenant.ModuleCode;
import co.ehealth.platform.identity.PermissionLevel;
import co.ehealth.platform.identity.PermissionService;
import co.ehealth.platform.identity.User;
import co.ehealth.platform.identity.UserRepository;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/pharmacy/stock/orders")
public class PharmacyStockOrderController {

    private final PharmacyStockOrderService service;
    private final PermissionService permissions;
    private final UserRepository users;

    public PharmacyStockOrderController(PharmacyStockOrderService service, PermissionService permissions, UserRepository users) {
        this.service = service;
        this.permissions = permissions;
        this.users = users;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public PharmacyStockOrderService.OrderView create(@Valid @RequestBody CreateOrderRequest request,
            @AuthenticationPrincipal AuthenticatedPrincipal principal) {
        permissions.requireAccess(ModuleCode.PHRM, PermissionLevel.MANAGE);
        permissions.requireAnyRole(Set.of("Stock Control Manager"), "Stock Control Manager role is required.");
        User actor = currentUser(principal);
        return service.create(new PharmacyStockOrderService.CreateCommand(request.facilityId(), request.lines().stream()
                .map(line -> new PharmacyStockOrderService.LineRequest(line.productId(), line.quantity())).toList()),
                actor.getId(), fullName(actor), actor.getFacilityId());
    }

    @PostMapping("/{id}/authorise")
    public PharmacyStockOrderService.OrderView authorise(@PathVariable UUID id,
            @AuthenticationPrincipal AuthenticatedPrincipal principal) {
        permissions.requireAnyRole(Set.of("Facility Manager"), "Facility Manager role is required.");
        User actor = currentUser(principal);
        return service.authorise(id, actor.getId(), fullName(actor), actor.getFacilityId());
    }

    @PostMapping("/{id}/submit")
    public PharmacyStockOrderService.OrderView submit(@PathVariable UUID id,
            @AuthenticationPrincipal AuthenticatedPrincipal principal) {
        permissions.requireAccess(ModuleCode.PHRM, PermissionLevel.MANAGE);
        User actor = currentUser(principal);
        service.requireAuthorisedForSubmission(id, actor.getFacilityId());
        permissions.requireAnyRole(Set.of("Stock Control Manager"), "Stock Control Manager role is required.");
        return service.submit(id, actor.getId(), actor.getFacilityId());
    }

    @GetMapping
    public Map<String, List<PharmacyStockOrderService.OrderView>> list(@RequestParam UUID facilityId,
            @AuthenticationPrincipal AuthenticatedPrincipal principal) {
        permissions.requireAccess(ModuleCode.PHRM, PermissionLevel.VIEW);
        User actor = currentUser(principal);
        return Map.of("items", service.list(facilityId, actor.getFacilityId()));
    }

    @GetMapping("/{id}")
    public PharmacyStockOrderService.OrderView get(@PathVariable UUID id,
            @AuthenticationPrincipal AuthenticatedPrincipal principal) {
        permissions.requireAccess(ModuleCode.PHRM, PermissionLevel.VIEW);
        return service.get(id, currentUser(principal).getFacilityId());
    }

    private User currentUser(AuthenticatedPrincipal principal) {
        return users.findById(principal.userId()).orElseThrow();
    }

    private String fullName(User user) {
        return user.getFirstName() + " " + user.getLastName();
    }

    public record OrderLineRequest(@NotNull UUID productId, @Positive int quantity) {}
    public record CreateOrderRequest(@NotNull UUID facilityId, @NotEmpty List<@Valid OrderLineRequest> lines) {}
}