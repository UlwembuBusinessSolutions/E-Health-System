package co.ehealth.platform.platform;

import co.ehealth.platform.core.audit.AuditLogService;
import co.ehealth.platform.core.notification.EmailService;
import co.ehealth.platform.core.tenant.Organization;
import co.ehealth.platform.core.tenant.OrganizationRepository;
import co.ehealth.platform.core.tenant.OrganizationStatus;
import co.ehealth.platform.core.tenant.SectorType;
import co.ehealth.platform.core.tenant.TenantContext;
import co.ehealth.platform.core.tenant.TenantMigrationRunner;
import co.ehealth.platform.identity.DuplicateFieldException;
import co.ehealth.platform.identity.Gender;
import co.ehealth.platform.identity.StaffService;
import co.ehealth.platform.identity.User;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;

import java.security.SecureRandom;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.regex.Pattern;

import co.ehealth.platform.core.tenant.SectorType;

@Service
public class OrganizationProvisioningService {

    private static final Pattern SLUG_PATTERN = Pattern.compile("^[a-z][a-z0-9-]{1,61}[a-z0-9]$");
    private static final String TEMP_PASSWORD_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
    private static final SecureRandom RANDOM = new SecureRandom();

    private final OrganizationRepository organizationRepository;
    private final TenantMigrationRunner migrationRunner;
    // identity.StaffService, not UserRepository/RoleRepository directly —
    // see the why-note on StaffService.createOrgAdmin() for why this
    // service routes admin creation through identity's own service layer
    // rather than reaching into its repositories, per the "no module calls
    // another module's repository directly" rule from the Phase 1 dev
    // brief (Section 2, ownership matrix). AuditLogService is exempt from
    // that rule by design — it's explicitly the one shared write path
    // every module is expected to call directly.
    private final StaffService staffService;
    private final AuditLogService auditLogService;
    private final PlatformAuditLogRepository platformAuditLogRepository;
    private final EmailService emailService;

    public OrganizationProvisioningService(OrganizationRepository organizationRepository,
            TenantMigrationRunner migrationRunner, StaffService staffService, AuditLogService auditLogService,
            PlatformAuditLogRepository platformAuditLogRepository, EmailService emailService) {
        this.organizationRepository = organizationRepository;
        this.migrationRunner = migrationRunner;
        this.staffService = staffService;
        this.auditLogService = auditLogService;
        this.platformAuditLogRepository = platformAuditLogRepository;
        this.emailService = emailService;
    }

    // Deliberately not one @Transactional: the Organization row lives in
    // the control schema, everything from provisionTenantSchema() onward
    // lives in a schema that doesn't exist until that call returns — a
    // single transaction can't span both. If the process dies partway
    // through, the result is an organization with no admin yet, fixable by
    // re-running provisioning for that slug; nothing here auto-retries it.
    public ProvisionedOrganization provisionOrganization(ProvisionOrganizationCommand cmd, UUID actingOperatorId) {
        String slug = requireValidSlug(cmd.slug());
        if (organizationRepository.existsBySlug(slug)) {
            throw new DuplicateFieldException("slug", "This slug is already in use.");
        }
        // Safe by construction, not by coincidence: SLUG_PATTERN only
        // allows [a-z0-9-], so swapping '-' for '_' can only ever produce
        // something matching TenantConnectionProvider's SAFE_SCHEMA regex
        // — [a-z][a-z0-9_]{2,62} — which is the thing that actually gets
        // concatenated into SET search_path.
        String schemaName = slug.replace('-', '_');

        Organization organization = new Organization(slug, schemaName, cmd.displayName(), cmd.sectorType());
        organizationRepository.save(organization);

        migrationRunner.provisionTenantSchema(schemaName);

        List<ProvisionedAdmin> admins = createAdmins(cmd.admins(), schemaName, cmd.displayName(), slug,
                "ORGANIZATION_PROVISIONED", organization.getId());

        recordPlatformAudit(actingOperatorId, "ORGANIZATION_PROVISIONED", organization.getId());

        return new ProvisionedOrganization(organization.getId(), slug, schemaName, admins);
    }

    // The fix for "client's only admin is locked out / left / wants more
    // admins added by us, not by themselves" — the gap being that
    // provisionOrganization() above only ever creates admins alongside a
    // brand-new organization, and StaffService.createStaff() requires
    // already being logged in as that org's admin. This is the third path:
    // platform-operator-authenticated, targeting an organization that
    // already exists, and — like provisioning — able to add more than one
    // admin in a single call.
    //
    // Also not @Transactional, same reasoning as provisionOrganization()
    // above: organizationRepository.findById() reads the control schema,
    // createAdminUser() writes the tenant schema, and Spring typically
    // acquires one connection per transaction — opened against whichever
    // schema was active for the *first* query, before TenantContext gets
    // set inside createAdminUser(). Wrapping both in one @Transactional
    // risks the tenant writes silently running against the control
    // connection instead of switching, not just failing loudly.
    public ProvisionedOrganization addAdmins(UUID organizationId, AddAdminsCommand cmd, UUID actingOperatorId) {
        Organization organization = organizationRepository.findById(organizationId)
                .orElseThrow(OrganizationNotFoundException::new);
        if (organization.getStatus() != OrganizationStatus.ACTIVE) {
            // Suspension is supposed to mean nothing works against this
            // org until it's reactivated — including this. Otherwise
            // suspend() (the "license off" switch) would have a hole: the
            // org can't be logged into, but the platform team could still
            // hand out working credentials for it.
            throw new OrganizationSuspendedException("Cannot add an admin to a suspended organization");
        }

        List<ProvisionedAdmin> admins = createAdmins(cmd.admins(), organization.getSchemaName(),
                organization.getDisplayName(), organization.getSlug(), "ORGANIZATION_ADMIN_ADDED", organizationId);

        recordPlatformAudit(actingOperatorId, "ORGANIZATION_ADMIN_ADDED", organizationId);

        return new ProvisionedOrganization(organization.getId(), organization.getSlug(),
                organization.getSchemaName(), admins);
    }

    public Organization getOrganization(UUID organizationId) {
        return organizationRepository.findById(organizationId)
                .orElseThrow(OrganizationNotFoundException::new);
    }

    // The read half of a gap that had no lever at all before this: the
    // platform team could add admins to an org, but never see who currently
    // holds ORG_ADMIN for it. Same TenantContext set/clear-in-finally
    // discipline as createAdminUser() — this reads a tenant-schema table
    // (user_roles, joined to users) from a request that was never routed to
    // that tenant by TenantFilter in the first place.
    public List<StaffService.AdminSummary> listAdmins(UUID organizationId) {
        Organization organization = organizationRepository.findById(organizationId)
                .orElseThrow(OrganizationNotFoundException::new);
        TenantContext.setCurrentTenant(organization.getSchemaName());
        try {
            return staffService.listOrgAdmins();
        } finally {
            TenantContext.clear();
        }
    }

    // The write half — the actual fix for "an admin is locked out / left,
    // and there's nobody else with platform access to remove them." Routed
    // through StaffService, not UserRepository directly, same module-
    // boundary rule as createAdminUser(). The last-remaining-admin safety
    // check lives in StaffService itself, not here — it needs the same
    // tenant-scoped query this method already has to make, so duplicating
    // it at this layer would just be two places that could disagree.
    public void removeAdmin(UUID organizationId, UUID userId, UUID actingOperatorId) {
        Organization organization = organizationRepository.findById(organizationId)
                .orElseThrow(OrganizationNotFoundException::new);
        TenantContext.setCurrentTenant(organization.getSchemaName());
        try {
            staffService.revokeOrgAdminRole(userId);
        } finally {
            TenantContext.clear();
        }
        recordPlatformAudit(actingOperatorId, "ORGANIZATION_ADMIN_REMOVED", organizationId);
    }

    public void suspend(UUID organizationId, UUID actingOperatorId) {
        Organization organization = organizationRepository.findById(organizationId)
                .orElseThrow(OrganizationNotFoundException::new);
        organization.suspend();
        organizationRepository.save(organization);
        recordPlatformAudit(actingOperatorId, "ORGANIZATION_SUSPENDED", organizationId);
    }

    public void reactivate(UUID organizationId, UUID actingOperatorId) {
        Organization organization = organizationRepository.findById(organizationId)
                .orElseThrow(OrganizationNotFoundException::new);
        organization.reactivate();
        organizationRepository.save(organization);
        recordPlatformAudit(actingOperatorId, "ORGANIZATION_REACTIVATED", organizationId);
    }

    // The seller-side write path, alongside AuditLogService's tenant-side
    // one — control.platform_audit_log and each tenant's own audit_log are
    // two separate tables rather than one shared schema, since a platform
    // operator isn't a row in any tenant's users table.
    private void recordPlatformAudit(UUID actingOperatorId, String action, UUID organizationId) {
        platformAuditLogRepository.save(
                new PlatformAuditLog(actingOperatorId, action, organizationId, Instant.now()));
    }

    // Still no pagination — see the original why-note below, still true.
    // Search/status-filter/sort added once the org list actually grew
    // large enough during real testing that scrolling a flat, unordered
    // list to find one client stopped being reasonable — the same
    // trigger pagination itself is waiting on, just reached first.
    //
    // No pagination — organizations get created one at a time by a human
    // running client onboarding, not at a volume where "page 4 of clients"
    // is a real scenario yet. Revisit if that stops being true.
    public List<Organization> listOrganizations(String query, OrganizationStatus status, boolean oldestFirst) {
        Specification<Organization> spec = Specification.where(null);

        // Case-insensitive substring match on either field — a client
        // onboarding someone types "riverbend" expecting it to match
        // "Riverbend Health Group" (displayName) or "riverbend-health"
        // (slug) without caring which one they're actually typing.
        if (query != null && !query.isBlank()) {
            String pattern = "%" + query.trim().toLowerCase() + "%";
            spec = spec.and((root, cq, cb) -> cb.or(
                    cb.like(cb.lower(root.get("displayName")), pattern),
                    cb.like(cb.lower(root.get("slug")), pattern)));
        }

        if (status != null) {
            spec = spec.and((root, cq, cb) -> cb.equal(root.get("status"), status));
        }

        Sort sort = Sort.by(oldestFirst ? Sort.Direction.ASC : Sort.Direction.DESC, "createdAt");
        return organizationRepository.findAll(spec, sort);
    }

    // Loops createAdminUser() once per requested admin — provisioning an
    // organization, or adding admins to one that exists, both take a list
    // now rather than exactly one: a client's real rollout is rarely a
    // single person, and forcing the platform team into N separate API
    // calls for N admins was never a real constraint, just an artifact of
    // the first version of this service only handling one. Deliberately
    // not atomic across the list: if admin 3 of 5 fails a uniqueness
    // check, 1 and 2 already exist and 4-5 are never attempted — same
    // "provisioning isn't atomic" gap already true of this service
    // overall, just visible one level deeper now. Each admin's own
    // creation is still all-or-nothing (StaffService.createOrgAdmin()
    // runs inside its own @Transactional).
    private List<ProvisionedAdmin> createAdmins(List<AdminInput> adminInputs, String schemaName,
            String organizationDisplayName, String organizationSlug,
            String auditAction, UUID auditEntityId) {
        List<ProvisionedAdmin> created = new ArrayList<>(adminInputs.size());
        for (AdminInput input : adminInputs) {
            String temporaryPassword = generateTemporaryPassword();
            User admin = createAdminUser(input, schemaName, temporaryPassword, organizationDisplayName,
                    organizationSlug, auditAction, auditEntityId);
            created.add(new ProvisionedAdmin(admin.getId(), admin.getEmail(), temporaryPassword));
        }
        return created;
    }

    // Writing into a schema this request was never routed to by
    // TenantFilter — neither call site (a brand-new org, or an existing
    // one reached only by a platform operator token) had a tenant resolved
    // for this request in the first place. Same discipline TenantFilter
    // itself uses: set it, use it, clear it in finally, on every path
    // including exceptions.
    //
    // auditAction/auditEntityId are parameters here rather than left to
    // each caller, on purpose: audit_log is a tenant-schema table, same as
    // users. Writing it here, before TenantContext.clear() runs, is what
    // keeps the entry inside the tenant it's supposed to belong to.
    private User createAdminUser(AdminInput details, String schemaName, String temporaryPassword,
            String organizationDisplayName, String organizationSlug, String auditAction,
            UUID auditEntityId) {
        TenantContext.setCurrentTenant(schemaName);
        try {
            User admin = staffService.createOrgAdmin(details.firstName(), details.lastName(),
                    details.employeeNumber(), details.email(), details.contactNumber(), details.gender(),
                    temporaryPassword);
            auditLogService.append(admin.getId(), null, auditAction, "Organization",
                    auditEntityId.toString(), null, null, null);
            // "Approved" in this system means exactly this moment — see
            // the why-note on EmailService.sendAdminAccountCreatedEmail.
            // Doesn't need TenantContext to be set, but runs here anyway
            // to keep the full "an admin now exists" sequence in one
            // place; a failed send is swallowed inside EmailService and
            // never affects this method's outcome.
            emailService.sendAdminAccountCreatedEmail(admin.getEmail(), admin.getFirstName(), organizationDisplayName,
                    organizationSlug, temporaryPassword);
            return admin;
        } finally {
            TenantContext.clear();
        }
    }

    private String requireValidSlug(String slug) {
        if (!SLUG_PATTERN.matcher(slug).matches()) {
            throw new IllegalArgumentException("Slug must be lowercase letters, digits and hyphens only.");
        }
        return slug;
    }

    private String generateTemporaryPassword() {
        StringBuilder password = new StringBuilder(16);
        for (int i = 0; i < 16; i++) {
            password.append(TEMP_PASSWORD_CHARS.charAt(RANDOM.nextInt(TEMP_PASSWORD_CHARS.length())));
        }
        return password.toString();
    }

    public record ProvisionOrganizationCommand(String slug, String displayName, SectorType sectorType,
            List<AdminInput> admins) {
    }

    public record AddAdminsCommand(List<AdminInput> admins) {
    }

    // What createAdminUser() needs for one admin, independent of whether
    // it's one of an organization's first batch (provisionOrganization) or
    // added to one that already exists (addAdmins).
    public record AdminInput(String firstName, String lastName, String employeeNumber, String email,
            String contactNumber, Gender gender) {
    }

    // temporaryPassword is returned exactly once, in this response — never
    // stored anywhere retrievable, never logged. Lost after this call? The
    // fix is the same as for any staff member: a password reset, not a way
    // to look the original value back up.
    public record ProvisionedAdmin(UUID userId, String email, String temporaryPassword) {
    }

    public record ProvisionedOrganization(
            UUID organizationId, String slug, String schemaName, List<ProvisionedAdmin> admins) {
    }
}
