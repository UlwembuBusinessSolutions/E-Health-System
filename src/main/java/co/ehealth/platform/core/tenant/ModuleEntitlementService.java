package co.ehealth.platform.core.tenant;

import co.ehealth.platform.core.audit.AuditLogService;
import co.ehealth.platform.platform.FoundationModuleException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

// The tenant-self-service write half of module entitlements —
// OrganizationProvisioningService.toggleModule() is the platform-operator
// equivalent (an arbitrary org by id, actor is a PlatformOperator, writes
// to PlatformAuditLog); this one always targets the caller's own org
// (TenantContext, same "resolve from the current tenant" shape as
// OrganizationBrandingService/OrganizationMailSettingsService) and writes
// to the tenant's own AuditLogService instead, since the actor here is an
// ORG_ADMIN's User id, not a PlatformOperator id — the two audit trails
// use different actor id spaces and were never meant to mix.
// FoundationModuleException is reused as-is from platform/ rather than
// duplicated — GlobalExceptionHandler already treats it as a shared,
// cross-module exception type (same precedent identity's
// AccountLockedException/InvalidCredentialsException set for
// PlatformAuthService/PatientAuthService).
@Service
public class ModuleEntitlementService {

    private final ModuleEntitlementRepository moduleEntitlementRepository;
    private final OrganizationRepository organizationRepository;
    private final AuditLogService auditLogService;

    public ModuleEntitlementService(ModuleEntitlementRepository moduleEntitlementRepository,
                                     OrganizationRepository organizationRepository,
                                     AuditLogService auditLogService) {
        this.moduleEntitlementRepository = moduleEntitlementRepository;
        this.organizationRepository = organizationRepository;
        this.auditLogService = auditLogService;
    }

    // Same Foundation guard and same upsert-a-sparse-row shape as
    // OrganizationProvisioningService.toggleModule() — see ModuleEntitlement's
    // own why-note on why only non-Foundation modules ever get a row at all.
    @Transactional
    public void toggleOwnModule(ModuleCode moduleCode, boolean enabled, UUID actingUserId) {
        if (moduleCode.isFoundation()) {
            throw new FoundationModuleException(moduleCode);
        }
        Organization organization = organizationRepository.findBySchemaName(TenantContext.getCurrentTenant())
                .orElseThrow(() -> new IllegalStateException("Unknown organization for current tenant"));

        ModuleEntitlement entitlement = moduleEntitlementRepository
                .findByOrganizationIdAndModuleCode(organization.getId(), moduleCode)
                .orElseGet(() -> new ModuleEntitlement(organization.getId(), moduleCode, false));
        boolean previous = entitlement.isEnabled();
        entitlement.setEnabled(enabled);
        moduleEntitlementRepository.save(entitlement);

        // beforeValue/afterValue land in audit_log's jsonb columns — a bare
        // ON/OFF word isn't valid JSON on its own (Postgres rejects it with
        // "invalid input syntax for type json"), so each is quoted into a
        // real JSON string literal, same requirement AuthService.login()
        // meets via ObjectMapper.writeValueAsString() for its own richer
        // snapshot.
        auditLogService.append(actingUserId, null, "MODULE_TOGGLED", "ModuleEntitlement", moduleCode.name(),
                "\"%s\"".formatted(previous ? "ON" : "OFF"), "\"%s\"".formatted(enabled ? "ON" : "OFF"));
    }
}
