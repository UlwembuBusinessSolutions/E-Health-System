package co.ehealth.platform.platform;

import co.ehealth.platform.core.tenant.Organization;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/v1/tenants")
public class TenantRegisterController {

    private final TenantRegisterService tenantRegisterService;

    public TenantRegisterController(TenantRegisterService tenantRegisterService) {
        this.tenantRegisterService = tenantRegisterService;
    }

    @GetMapping
    public ResponseEntity<TenantPageResponse> list(
            @RequestParam(required = false) String name,
            @RequestParam(defaultValue = "0") @Min(0) int page,
            @RequestParam(defaultValue = "25") @Min(1) @Max(100) int size) {
        var tenantPage = tenantRegisterService.findTenants(name,
                PageRequest.of(page, size, Sort.by(Sort.Direction.ASC, "displayName")));
        List<Organization> organizations = tenantPage.getContent();
        var moduleCounts = tenantRegisterService.activeModuleCounts(
                organizations.stream().map(Organization::getId).toList());
        var clinicCounts = tenantRegisterService.clinicCounts(organizations);
        var items = organizations.stream().map(organization -> new TenantResponse(
                organization.getId(), organization.getDisplayName(), organization.getSector(), organization.getStatus(),
                clinicCounts.getOrDefault(organization.getId(), 0),
                moduleCounts.getOrDefault(organization.getId(), 0))).toList();
        return ResponseEntity.ok(new TenantPageResponse(items, tenantPage.getNumber(), tenantPage.getSize(),
                tenantPage.getTotalElements(), tenantPage.getTotalPages()));
    }

    public record TenantResponse(java.util.UUID id, String name,
                                 co.ehealth.platform.core.tenant.OrganizationSector sector,
                                 co.ehealth.platform.core.tenant.OrganizationStatus status,
                                 int clinicCount, int activeModuleCount) { }

    public record TenantPageResponse(List<TenantResponse> items, int page, int size,
                                     long totalElements, int totalPages) { }
}
