package co.ehealth.platform.platform;

import co.ehealth.platform.core.audit.AuditLogService;
import co.ehealth.platform.core.notification.EmailService;
import co.ehealth.platform.core.tenant.ModuleCode;
import co.ehealth.platform.core.tenant.ModuleEntitlement;
import co.ehealth.platform.core.tenant.ModuleEntitlementRepository;
import co.ehealth.platform.core.tenant.ModuleEntitlementCache;
import co.ehealth.platform.core.tenant.Organization;
import co.ehealth.platform.core.tenant.OrganizationRepository;
import co.ehealth.platform.core.tenant.OrganizationStatus;
import co.ehealth.platform.core.tenant.TenantContext;
import co.ehealth.platform.core.tenant.TenantMigrationRunner;
import co.ehealth.platform.identity.DuplicateFieldException;
import co.ehealth.platform.identity.Gender;
import co.ehealth.platform.identity.StaffService;
import co.ehealth.platform.identity.User;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.regex.Pattern;

@Service
public class OrganizationProvisioningService {

    private static final Pattern SLUG_PATTERN =
            Pattern.compile("^[a-z][a-z0-9-]{1,61}[a-z0-9]$");

    private static final String TEMP_PASSWORD_CHARS =
            "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

    private static final SecureRandom RANDOM = new SecureRandom();

    private final OrganizationRepository organizationRepository;
    private final TenantMigrationRunner migrationRunner;
    private final StaffService staffService;
    private final AuditLogService auditLogService;
    private final PlatformAuditLogRepository platformAuditLogRepository;
    private final EmailService emailService;
    private final ModuleEntitlementRepository moduleEntitlementRepository;
    private final ModuleEntitlementCache moduleEntitlementCache;

    public OrganizationProvisioningService(
            OrganizationRepository organizationRepository,
            TenantMigrationRunner migrationRunner,
            StaffService staffService,
            AuditLogService auditLogService,
            PlatformAuditLogRepository platformAuditLogRepository,
            EmailService emailService,
            ModuleEntitlementRepository moduleEntitlementRepository,
            ModuleEntitlementCache moduleEntitlementCache
    ) {
        this.organizationRepository = organizationRepository;
        this.migrationRunner = migrationRunner;
        this.staffService = staffService;
        this.auditLogService = auditLogService;
        this.platformAuditLogRepository = platformAuditLogRepository;
        this.emailService = emailService;
        this.moduleEntitlementRepository = moduleEntitlementRepository;
        this.moduleEntitlementCache = moduleEntitlementCache;
    }

    // -------------------------------------------------------------------------
    // ORGANIZATION PROVISIONING
    // -------------------------------------------------------------------------

    /*
     * Existing method kept for compatibility with existing callers.
     *
     * If the caller does not currently have an IP address available,
     * the audit IP will be stored as NULL.
     */
    public ProvisionedOrganization provisionOrganization(
            ProvisionOrganizationCommand cmd,
            UUID actingOperatorId
    ) {
        return provisionOrganization(
                cmd,
                actingOperatorId,
                null
        );
    }

    /*
     * New version that accepts the request IP address.
     */
    public ProvisionedOrganization provisionOrganization(
            ProvisionOrganizationCommand cmd,
            UUID actingOperatorId,
            String ipAddress
    ) {

        String slug = requireValidSlug(cmd.slug());

        if (organizationRepository.existsBySlug(slug)) {
            throw new DuplicateFieldException(
                    "slug",
                    "This slug is already in use."
            );
        }

        String schemaName = slug.replace('-', '_');

        Organization organization =
                new Organization(
                        slug,
                        schemaName,
                        cmd.displayName()
                );

        organizationRepository.save(organization);

        /*
         * Deliberately not one @Transactional:
         * the Organization row lives in the control schema, everything from
         * provisionTenantSchema() onward lives in a schema that doesn't exist
         * until that call returns.
         */
        migrationRunner.provisionTenantSchema(schemaName);

        List<ProvisionedAdmin> admins =
                createAdmins(
                        cmd.admins(),
                        schemaName,
                        cmd.displayName(),
                        slug,
                        "ORGANIZATION_PROVISIONED",
                        organization.getId(),
                        ipAddress
                );

        recordPlatformAudit(
                actingOperatorId,
                "ORGANIZATION_PROVISIONED",
                organization.getId()
        );

        return new ProvisionedOrganization(
                organization.getId(),
                slug,
                schemaName,
                admins
        );
    }

    // -------------------------------------------------------------------------
    // ADD ORGANIZATION ADMINS
    // -------------------------------------------------------------------------

    /*
     * Existing method kept for compatibility.
     */
    public ProvisionedOrganization addAdmins(
            UUID organizationId,
            AddAdminsCommand cmd,
            UUID actingOperatorId
    ) {
        return addAdmins(
                organizationId,
                cmd,
                actingOperatorId,
                null
        );
    }

    /*
     * New version accepting IP address.
     */
    public ProvisionedOrganization addAdmins(
            UUID organizationId,
            AddAdminsCommand cmd,
            UUID actingOperatorId,
            String ipAddress
    ) {

        Organization organization =
                organizationRepository.findById(organizationId)
                        .orElseThrow(
                                OrganizationNotFoundException::new
                        );

        if (organization.getStatus() != OrganizationStatus.ACTIVE) {
            throw new OrganizationSuspendedException(
                    "Cannot add an admin to a suspended organization"
            );
        }

        List<ProvisionedAdmin> admins =
                createAdmins(
                        cmd.admins(),
                        organization.getSchemaName(),
                        organization.getDisplayName(),
                        organization.getSlug(),
                        "ORGANIZATION_ADMIN_ADDED",
                        organizationId,
                        ipAddress
                );

        recordPlatformAudit(
                actingOperatorId,
                "ORGANIZATION_ADMIN_ADDED",
                organizationId
        );

        return new ProvisionedOrganization(
                organization.getId(),
                organization.getSlug(),
                organization.getSchemaName(),
                admins
        );
    }

    // -------------------------------------------------------------------------
    // GET ORGANIZATION
    // -------------------------------------------------------------------------

    public Organization getOrganization(UUID organizationId) {

        return organizationRepository.findById(organizationId)
                .orElseThrow(
                        OrganizationNotFoundException::new
                );
    }

    // -------------------------------------------------------------------------
    // LIST ORGANIZATION ADMINS
    // -------------------------------------------------------------------------

    public List<StaffService.AdminSummary> listAdmins(
            UUID organizationId
    ) {

        Organization organization =
                organizationRepository.findById(organizationId)
                        .orElseThrow(
                                OrganizationNotFoundException::new
                        );

        TenantContext.setCurrentTenant(
                organization.getSchemaName()
        );

        try {
            return staffService.listOrgAdmins();
        } finally {
            TenantContext.clear();
        }
    }

    // -------------------------------------------------------------------------
    // REMOVE ORGANIZATION ADMIN
    // -------------------------------------------------------------------------

    public void removeAdmin(
            UUID organizationId,
            UUID userId,
            UUID actingOperatorId
    ) {

        Organization organization =
                organizationRepository.findById(organizationId)
                        .orElseThrow(
                                OrganizationNotFoundException::new
                        );

        TenantContext.setCurrentTenant(
                organization.getSchemaName()
        );

        try {
            staffService.revokeOrgAdminRole(userId);
        } finally {
            TenantContext.clear();
        }

        recordPlatformAudit(
                actingOperatorId,
                "ORGANIZATION_ADMIN_REMOVED",
                organizationId
        );
    }

    // -------------------------------------------------------------------------
    // SUSPEND ORGANIZATION
    // -------------------------------------------------------------------------

    public void suspend(
            UUID organizationId,
            UUID actingOperatorId
    ) {

        Organization organization =
                organizationRepository.findById(organizationId)
                        .orElseThrow(
                                OrganizationNotFoundException::new
                        );

        organization.suspend();

        organizationRepository.save(organization);

        recordPlatformAudit(
                actingOperatorId,
                "ORGANIZATION_SUSPENDED",
                organizationId
        );
    }

    // -------------------------------------------------------------------------
    // REACTIVATE ORGANIZATION
    // -------------------------------------------------------------------------

    public void reactivate(
            UUID organizationId,
            UUID actingOperatorId
    ) {

        Organization organization =
                organizationRepository.findById(organizationId)
                        .orElseThrow(
                                OrganizationNotFoundException::new
                        );

        organization.reactivate();

        organizationRepository.save(organization);

        recordPlatformAudit(
                actingOperatorId,
                "ORGANIZATION_REACTIVATED",
                organizationId
        );
    }

    // -------------------------------------------------------------------------
    // ENABLE / DISABLE MODULE
    // -------------------------------------------------------------------------

    /**
     * Enables or disables a non-foundation module for an organization.
     *
     * Foundation modules are always enabled and cannot be disabled.
     * Organization-level entitlements are represented by a NULL clinic_id.
     */
    @Transactional
    public void setModuleEnabled(
            UUID organizationId,
            ModuleCode moduleCode,
            boolean enabled,
            UUID actingOperatorId
    ) {

        if (moduleCode == null) {
            throw new IllegalArgumentException(
                    "Module code is required."
            );
        }

        if (moduleCode.isFoundation()) {
            throw new FoundationModuleException(
                    moduleCode
                            + " is a Platform Foundation module and cannot be disabled."
            );
        }

        if (!organizationRepository.existsById(organizationId)) {
            throw new OrganizationNotFoundException();
        }

        ModuleEntitlement entitlement =
                moduleEntitlementRepository
                        .findByTenantIdAndModuleCodeAndClinicIdIsNull(
                                organizationId,
                                moduleCode
                        )
                        .orElseGet(
                                () ->
                                        new ModuleEntitlement(
                                                organizationId,
                                                moduleCode,
                                                // No entitlement means the module was not available before
                                                // this toggle. Initialise it as disabled so the audit event
                                                // accurately records the state transition below.
                                                false
                                        )
                        );
        boolean previousEnabled = entitlement.isEnabled();
        entitlement.setEnabled(enabled);

        moduleEntitlementRepository.save(entitlement);
        moduleEntitlementCache.invalidate(organizationId);

        recordModuleToggled(actingOperatorId, organizationId, moduleCode, previousEnabled, enabled);
    }

    /** All module states for the Super Admin entitlement screen. Foundation modules are always on. */
    @Transactional(readOnly = true)
    public List<ModuleState> listModuleStates(UUID organizationId) {
        if (!organizationRepository.existsById(organizationId)) {
            throw new OrganizationNotFoundException();
        }
        var configured = moduleEntitlementRepository.findByTenantId(organizationId).stream()
                .collect(java.util.stream.Collectors.toMap(ModuleEntitlement::getModuleCode,
                        ModuleEntitlement::isEnabled, (first, ignored) -> first));
        return java.util.Arrays.stream(ModuleCode.values())
                .map(moduleCode -> new ModuleState(moduleCode,
                        moduleCode.isFoundation() || configured.getOrDefault(moduleCode, false),
                        moduleCode.isFoundation()))
                .toList();
    }

    public record ModuleState(ModuleCode moduleCode, boolean enabled, boolean foundation) { }

    // -------------------------------------------------------------------------
    // PLATFORM AUDIT
    // -------------------------------------------------------------------------

    private void recordPlatformAudit(
            UUID actingOperatorId,
            String action,
            UUID organizationId
    ) {

        platformAuditLogRepository.save(
                new PlatformAuditLog(
                        actingOperatorId,
                        action,
                        organizationId,
                        Instant.now()
                )
        );
    }

    private void recordModuleToggled(UUID actingOperatorId, UUID organizationId,
                                     ModuleCode moduleCode, boolean previousEnabled, boolean enabled) {
        platformAuditLogRepository.save(new PlatformAuditLog(
                actingOperatorId, "MODULE_TOGGLED", organizationId, moduleCode,
                previousEnabled, enabled, Instant.now()));
    }

    // -------------------------------------------------------------------------
    // LIST ORGANIZATIONS
    // -------------------------------------------------------------------------

    public List<Organization> listOrganizations(
            String query,
            OrganizationStatus status,
            boolean oldestFirst
    ) {

        Specification<Organization> spec =
                Specification.where(null);

        if (query != null && !query.isBlank()) {

            String pattern =
                    "%"
                            + query.trim().toLowerCase()
                            + "%";

            spec = spec.and(
                    (root, cq, cb) ->
                            cb.or(
                                    cb.like(
                                            cb.lower(
                                                    root.get("displayName")
                                            ),
                                            pattern
                                    ),
                                    cb.like(
                                            cb.lower(
                                                    root.get("slug")
                                            ),
                                            pattern
                                    )
                            )
            );
        }

        if (status != null) {
            spec = spec.and(
                    (root, cq, cb) ->
                            cb.equal(
                                    root.get("status"),
                                    status
                            )
            );
        }

        Sort sort =
                Sort.by(
                        oldestFirst
                                ? Sort.Direction.ASC
                                : Sort.Direction.DESC,
                        "createdAt"
                );

        return organizationRepository.findAll(
                spec,
                sort
        );
    }

    // -------------------------------------------------------------------------
    // CREATE ADMINS
    // -------------------------------------------------------------------------

    private List<ProvisionedAdmin> createAdmins(
            List<AdminInput> adminInputs,
            String schemaName,
            String organizationDisplayName,
            String organizationSlug,
            String auditAction,
            UUID auditEntityId,
            String ipAddress
    ) {

        List<ProvisionedAdmin> created =
                new ArrayList<>(
                        adminInputs.size()
                );

        for (AdminInput input : adminInputs) {

            String temporaryPassword =
                    generateTemporaryPassword();

            User admin =
                    createAdminUser(
                            input,
                            schemaName,
                            temporaryPassword,
                            organizationDisplayName,
                            organizationSlug,
                            auditAction,
                            auditEntityId,
                            ipAddress
                    );

            created.add(
                    new ProvisionedAdmin(
                            admin.getId(),
                            admin.getEmail(),
                            temporaryPassword
                    )
            );
        }

        return created;
    }

    // -------------------------------------------------------------------------
    // CREATE ADMIN USER
    // -------------------------------------------------------------------------

    private User createAdminUser(
            AdminInput details,
            String schemaName,
            String temporaryPassword,
            String organizationDisplayName,
            String organizationSlug,
            String auditAction,
            UUID auditEntityId,
            String ipAddress
    ) {

        TenantContext.setCurrentTenant(
                schemaName
        );

        try {

            User admin =
                    staffService.createOrgAdmin(
                            details.firstName(),
                            details.lastName(),
                            details.employeeNumber(),
                            details.email(),
                            details.contactNumber(),
                            details.gender(),
                            temporaryPassword
                    );

            /*
             * AuditLogService.append() requires 8 arguments:
             *
             * 1. userId
             * 2. facilityId
             * 3. action
             * 4. entityType
             * 5. entityId
             * 6. beforeValue
             * 7. afterValue
             * 8. ipAddress
             */
            auditLogService.append(
                    admin.getId(),
                    null,
                    auditAction,
                    "Organization",
                    auditEntityId.toString(),
                    null,
                    null,
                    ipAddress
            );

            emailService.sendAdminAccountCreatedEmail(
                    admin.getEmail(),
                    admin.getFirstName(),
                    organizationDisplayName,
                    organizationSlug,
                    temporaryPassword
            );

            return admin;

        } finally {
            TenantContext.clear();
        }
    }

    // -------------------------------------------------------------------------
    // SLUG VALIDATION
    // -------------------------------------------------------------------------

    private String requireValidSlug(String slug) {

        if (!SLUG_PATTERN.matcher(slug).matches()) {
            throw new IllegalArgumentException(
                    "Slug must be lowercase letters, digits and hyphens only."
            );
        }

        return slug;
    }

    // -------------------------------------------------------------------------
    // TEMPORARY PASSWORD
    // -------------------------------------------------------------------------

    private String generateTemporaryPassword() {

        StringBuilder password =
                new StringBuilder(16);

        for (int i = 0; i < 16; i++) {

            password.append(
                    TEMP_PASSWORD_CHARS.charAt(
                            RANDOM.nextInt(
                                    TEMP_PASSWORD_CHARS.length()
                            )
                    )
            );
        }

        return password.toString();
    }

    // -------------------------------------------------------------------------
    // RECORDS
    // -------------------------------------------------------------------------

    public record ProvisionOrganizationCommand(
            String slug,
            String displayName,
            List<AdminInput> admins
    ) {
    }

    public record AddAdminsCommand(
            List<AdminInput> admins
    ) {
    }

    public record AdminInput(
            String firstName,
            String lastName,
            String employeeNumber,
            String email,
            String contactNumber,
            Gender gender
    ) {
    }

    public record ProvisionedAdmin(
            UUID userId,
            String email,
            String temporaryPassword
    ) {
    }

    public record ProvisionedOrganization(
            UUID organizationId,
            String slug,
            String schemaName,
            List<ProvisionedAdmin> admins
    ) {
    }
}
