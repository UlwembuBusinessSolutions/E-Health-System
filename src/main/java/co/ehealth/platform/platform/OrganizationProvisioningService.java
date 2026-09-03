package co.ehealth.platform.platform;

import co.ehealth.platform.core.audit.AuditLog;
import co.ehealth.platform.core.audit.AuditLogService;
import co.ehealth.platform.core.notification.EmailService;
import co.ehealth.platform.facility.Facility;
import co.ehealth.platform.facility.FacilityService;
import co.ehealth.platform.facility.FacilityType;
import co.ehealth.platform.core.tenant.ModuleCode;
import co.ehealth.platform.core.tenant.ModuleEntitlement;
import co.ehealth.platform.core.tenant.ModuleEntitlementQueryService;
import co.ehealth.platform.core.tenant.ModuleEntitlementRepository;
import co.ehealth.platform.core.tenant.ModuleEntitlementView;
import co.ehealth.platform.core.tenant.Organization;
import co.ehealth.platform.core.tenant.OrganizationBrandingService;
import co.ehealth.platform.core.tenant.OrganizationRepository;
import co.ehealth.platform.core.tenant.OrganizationSector;
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
import org.springframework.web.multipart.MultipartFile;

import java.security.SecureRandom;
import java.time.Instant;
import java.util.ArrayList;
import java.util.EnumSet;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@Service
public class OrganizationProvisioningService {

    private static final Pattern SLUG_PATTERN = Pattern.compile("^[a-z][a-z0-9-]{1,61}[a-z0-9]$");
    private static final String TEMP_PASSWORD_CHARS =
            "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
    private static final SecureRandom RANDOM = new SecureRandom();

    // What a brand-new tenant gets switched on by default, before any
    // platform operator has touched its entitlements — SADM-US-002. Every
    // sector gets the MVP0 clinical baseline (registration, reception/queue,
    // appointments, pharmacy, biometrics); sectors then add the Phase 2
    // modules that match their own service lines, per ModuleCode's own
    // descriptions: PUBLIC adds the community-health programmes South
    // African public clinics actually run (acute/minor ailments, chronic
    // care & CCMDD, maternal/child & SRH); OCCUPATIONAL adds occupational
    // health, its whole reason for existing as a sector; PRIVATE stays at
    // the MVP0 baseline — private practices bill per visit rather than
    // running public community-health programmes. This only governs what a
    // *new* tenant is seeded with; it never runs again for an existing one
    // — see updateDetails()'s own why-note on why changing an existing
    // tenant's sector deliberately leaves its entitlements untouched.
    private static final Map<OrganizationSector, Set<ModuleCode>> SECTOR_DEFAULT_MODULES = Map.of(
            OrganizationSector.PUBLIC, EnumSet.of(ModuleCode.PREG, ModuleCode.RECQ, ModuleCode.APPT,
                    ModuleCode.PHRM, ModuleCode.BIOM, ModuleCode.CSAC, ModuleCode.CSCC, ModuleCode.CSMC),
            OrganizationSector.PRIVATE, EnumSet.of(ModuleCode.PREG, ModuleCode.RECQ, ModuleCode.APPT,
                    ModuleCode.PHRM, ModuleCode.BIOM),
            OrganizationSector.OCCUPATIONAL, EnumSet.of(ModuleCode.PREG, ModuleCode.RECQ, ModuleCode.APPT,
                    ModuleCode.PHRM, ModuleCode.BIOM, ModuleCode.OCCH));

    // SADM/AUDT/IAM — never a row in module_entitlements (ModuleEntitlement's
    // own why-note), so every enabled-module count in this service starts
    // from this floor rather than 0.
    private static final int FOUNDATION_MODULE_COUNT = 3;
    public static final int TOTAL_MODULE_COUNT = ModuleCode.values().length;

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
    // core.tenant's own branding service — same "shared core package, fair
    // game across modules" reasoning as TenantContext/TenantMigrationRunner
    // above, not a second exception to the module-boundary rule.
    private final OrganizationBrandingService organizationBrandingService;
    private final ModuleEntitlementRepository moduleEntitlementRepository;
    private final ModuleEntitlementQueryService moduleEntitlementQueryService;
    // facility.FacilityService, not FacilityRepository directly — same
    // module-boundary rule as staffService above.
    private final FacilityService facilityService;

    public OrganizationProvisioningService(OrganizationRepository organizationRepository,
            TenantMigrationRunner migrationRunner, StaffService staffService, AuditLogService auditLogService,
            PlatformAuditLogRepository platformAuditLogRepository, EmailService emailService,
            OrganizationBrandingService organizationBrandingService,
            ModuleEntitlementRepository moduleEntitlementRepository,
            ModuleEntitlementQueryService moduleEntitlementQueryService,
            FacilityService facilityService) {
        this.organizationRepository = organizationRepository;
        this.migrationRunner = migrationRunner;
        this.staffService = staffService;
        this.auditLogService = auditLogService;
        this.platformAuditLogRepository = platformAuditLogRepository;
        this.emailService = emailService;
        this.organizationBrandingService = organizationBrandingService;
        this.moduleEntitlementRepository = moduleEntitlementRepository;
        this.moduleEntitlementQueryService = moduleEntitlementQueryService;
        this.facilityService = facilityService;
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

        Organization organization = new Organization(slug, schemaName, cmd.displayName(), cmd.sector());
        organizationRepository.save(organization);
        seedDefaultModuleEntitlements(organization.getId(), cmd.sector());

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

    // AUDT-US-005/006's platform-side entry point — a platform operator
    // viewing one tenant's own audit trail, same TenantContext set/clear-in-
    // finally discipline as listAdmins() above. Deliberately routed through
    // staffService.resolveUserNames() rather than reaching into
    // UserRepository directly, same module-boundary rule as everywhere else
    // this service crosses into identity/.
    public List<TenantAuditEntryView> listTenantAuditLog(UUID organizationId) {
        Organization organization = organizationRepository.findById(organizationId)
                .orElseThrow(OrganizationNotFoundException::new);
        TenantContext.setCurrentTenant(organization.getSchemaName());
        try {
            List<AuditLog> rows = auditLogService.listAll();
            Set<UUID> userIds = rows.stream().map(AuditLog::getUserId).filter(Objects::nonNull)
                    .collect(Collectors.toSet());
            Map<UUID, String> namesByUserId = staffService.resolveUserNames(userIds);
            return rows.stream().map(row -> new TenantAuditEntryView(
                    row.getId(), row.getAction(), row.getEntityType(), row.getEntityId(), row.getCreatedAt(),
                    namesByUserId.getOrDefault(row.getUserId(), "Unknown user"),
                    row.getBeforeValue(), row.getAfterValue(),
                    row.getIpAddress(), row.getDeviceSignature())).toList();
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

    // The platform-side counterpart to StaffController's own
    // /api/v1/admin/staff/{id}/reset-password — the actual fix for "an
    // admin is locked out and there's nobody left INSIDE the org who could
    // reset it for them." Routed through StaffService.resetPassword(),
    // same module-boundary rule as everywhere else this service crosses
    // into identity/. actingOperatorId is a platform operator id, not a
    // tenant User id, so it can't be threaded into StaffService.resetPassword()'s
    // own actingAdminId parameter (that ends up in the tenant schema's own
    // audit_log.user_id, a real User foreign key) — userId stands in for
    // itself there instead, same precedent createAdminUser() already
    // established for this exact "platform operator, no tenant identity to
    // attribute the tenant-side row to" situation.
    public String resetAdminPassword(UUID organizationId, UUID userId, UUID actingOperatorId) {
        Organization organization = organizationRepository.findById(organizationId)
                .orElseThrow(OrganizationNotFoundException::new);
        TenantContext.setCurrentTenant(organization.getSchemaName());
        String temporaryPassword;
        try {
            temporaryPassword = staffService.resetPassword(userId, userId);
        } finally {
            TenantContext.clear();
        }
        recordPlatformAudit(actingOperatorId, "ORGANIZATION_ADMIN_PASSWORD_RESET", organizationId);
        return temporaryPassword;
    }

    // The platform-side counterpart to StaffController's own
    // /api/v1/admin/staff/{id}/enable|disable. Same actingOperatorId ->
    // userId substitution as resetAdminPassword() above, same reason. The
    // last-remaining-admin guard lives inside StaffService.setEnabled()
    // itself, same "one place, not two that could disagree" reasoning as
    // removeAdmin()'s own why-note.
    public void setAdminEnabled(UUID organizationId, UUID userId, boolean enabled, UUID actingOperatorId) {
        Organization organization = organizationRepository.findById(organizationId)
                .orElseThrow(OrganizationNotFoundException::new);
        TenantContext.setCurrentTenant(organization.getSchemaName());
        try {
            staffService.setEnabled(userId, enabled, userId);
        } finally {
            TenantContext.clear();
        }
        recordPlatformAudit(actingOperatorId,
                enabled ? "ORGANIZATION_ADMIN_ENABLED" : "ORGANIZATION_ADMIN_DISABLED", organizationId);
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

    // The edit path SADM-US-002's own acceptance criteria describes
    // ("Given a tenant sector type is changed... existing module
    // entitlements are preserved and the change is audit-logged") — slug
    // and schemaName aren't part of this, see Organization.rename()'s own
    // why-note on why those stay permanent. Detail captures both old
    // values regardless of which one actually changed, same reasoning as
    // MODULE_TOGGLED's detail: cheap to always record, and an auditor
    // reading this later shouldn't have to guess whether a field that
    // looks unchanged really was.
    public void updateDetails(UUID organizationId, String displayName, OrganizationSector sector,
                               UUID actingOperatorId) {
        Organization organization = organizationRepository.findById(organizationId)
                .orElseThrow(OrganizationNotFoundException::new);
        String previousName = organization.getDisplayName();
        OrganizationSector previousSector = organization.getSector();

        organization.rename(displayName);
        organization.changeSector(sector);
        organizationRepository.save(organization);

        String detail = "name: '%s' -> '%s'; sector: %s -> %s"
                .formatted(previousName, displayName, previousSector, sector);
        platformAuditLogRepository.save(
                new PlatformAuditLog(actingOperatorId, "ORGANIZATION_DETAILS_UPDATED", organizationId, detail,
                        Instant.now()));
    }

    // The platform-side counterpart to OrganizationBrandingService.uploadLogo()
    // — that one only ever runs for a caller already authenticated as that
    // exact org (TenantContext), which provisioning's own admins can't be
    // yet at the moment an org is first created. Callable any time after,
    // not just at provisioning: re-uploading replaces the logo, same as the
    // tenant-side path.
    public String uploadLogo(UUID organizationId, MultipartFile file, UUID actingOperatorId) {
        Organization organization = organizationRepository.findById(organizationId)
                .orElseThrow(OrganizationNotFoundException::new);
        String url = organizationBrandingService.uploadLogoForOrganization(organization, file);
        recordPlatformAudit(actingOperatorId, "ORGANIZATION_LOGO_UPLOADED", organizationId);
        return url;
    }

    // SADM-US-006 — a platform operator adding a clinic to a tenant that
    // already exists. Same suspended-organization guard as addAdmins(): a
    // tenant that can't be logged into shouldn't be able to grow its
    // facility network either. Entitlement inheritance (the story's own
    // AC2) needs no code here — Facility carries no entitlement state of
    // its own (ModuleEntitlement is keyed by organization_id, not
    // facility_id, per SADM-US-002's own why-note on that architecture), so
    // a brand-new clinic reads exactly the modules its tenant already has
    // switched on, automatically, by construction. SADM-US-011 (per-clinic
    // override) is a separate, not-yet-built story for if that ever needs
    // to change.
    public Facility addClinic(UUID organizationId, AddClinicCommand cmd, UUID actingOperatorId) {
        Organization organization = organizationRepository.findById(organizationId)
                .orElseThrow(OrganizationNotFoundException::new);
        if (organization.getStatus() != OrganizationStatus.ACTIVE) {
            throw new OrganizationSuspendedException("Cannot add a clinic to a suspended organization");
        }

        TenantContext.setCurrentTenant(organization.getSchemaName());
        Facility facility;
        try {
            facility = facilityService.create(cmd.name(), cmd.code(), cmd.type(), cmd.address(), cmd.phone(),
                    cmd.operatingHours());
        } finally {
            TenantContext.clear();
        }

        String detail = "%s (%s)".formatted(facility.getName(), facility.getCode());
        platformAuditLogRepository.save(
                new PlatformAuditLog(actingOperatorId, "CLINIC_CREATED", organizationId, detail, Instant.now()));
        return facility;
    }

    // The read half, for the platform console's own clinic list on an
    // organization's detail page — same TenantContext set/clear-in-finally
    // discipline as listAdmins()/listTenantAuditLog() above, reading a
    // tenant-schema table (facilities) from a request that was never routed
    // to that tenant by TenantFilter.
    public List<Facility> listClinics(UUID organizationId) {
        Organization organization = organizationRepository.findById(organizationId)
                .orElseThrow(OrganizationNotFoundException::new);
        TenantContext.setCurrentTenant(organization.getSchemaName());
        try {
            return facilityService.list();
        } finally {
            TenantContext.clear();
        }
    }

    // SADM-US-010 — the full 20-module picture for one organization, not
    // just the rows that happen to exist: a Foundation module reads as
    // enabled unconditionally (it never gets a row at all, see
    // ModuleEntitlement's own why-note), and any other module with no row
    // yet (an org created before this feature existed, or one that's simply
    // never had this module touched) reads as disabled rather than 404ing
    // or omitting it from the response.
    public List<ModuleEntitlementView> listModuleEntitlements(UUID organizationId) {
        if (!organizationRepository.existsById(organizationId)) {
            throw new OrganizationNotFoundException();
        }
        return moduleEntitlementQueryService.listForOrganization(organizationId);
    }

    // The write half. Foundation protection is checked before anything
    // else — findById() below would otherwise waste a query establishing
    // an organization exists just to reject the request anyway.
    public void toggleModule(UUID organizationId, ModuleCode moduleCode, boolean enabled, UUID actingOperatorId) {
        if (moduleCode.isFoundation()) {
            throw new FoundationModuleException(moduleCode);
        }
        organizationRepository.findById(organizationId).orElseThrow(OrganizationNotFoundException::new);

        ModuleEntitlement entitlement = moduleEntitlementRepository
                .findByOrganizationIdAndModuleCode(organizationId, moduleCode)
                .orElseGet(() -> new ModuleEntitlement(organizationId, moduleCode, false));
        boolean previous = entitlement.isEnabled();
        entitlement.setEnabled(enabled);
        moduleEntitlementRepository.save(entitlement);

        String detail = "%s: %s -> %s".formatted(moduleCode, previous ? "ON" : "OFF", enabled ? "ON" : "OFF");
        platformAuditLogRepository.save(
                new PlatformAuditLog(actingOperatorId, "MODULE_TOGGLED", organizationId, detail, Instant.now()));
    }

    // The org list's "Modules" column (SADM-US-010, matching the eHealth
    // Prototype's own organisations table) — one grouped query for every
    // organization on the page rather than one listModuleEntitlements()
    // call per row. An id with no enabled non-Foundation rows at all never
    // appears in the repository's GROUP BY output, so it's seeded at the
    // Foundation floor before the real counts are folded in, same as any
    // other "absence means zero" read in this service.
    public Map<UUID, Integer> countEnabledModules(List<UUID> organizationIds) {
        Map<UUID, Integer> counts = new HashMap<>();
        for (UUID id : organizationIds) {
            counts.put(id, FOUNDATION_MODULE_COUNT);
        }
        if (organizationIds.isEmpty()) {
            return counts;
        }
        for (Object[] row : moduleEntitlementRepository.countEnabledByOrganizationIdIn(organizationIds)) {
            UUID organizationId = (UUID) row[0];
            long enabledNonFoundation = (Long) row[1];
            counts.put(organizationId, FOUNDATION_MODULE_COUNT + (int) enabledNonFoundation);
        }
        return counts;
    }

    // Run once, at provisioning — SECTOR_DEFAULT_MODULES' own why-note
    // explains what "default" means per sector today. Explicit rows for
    // every non-Foundation module (enabled or not), not just the enabled
    // ones: an org's module state should be fully auditable (existence +
    // updatedAt) from the moment it's created, not inferred from absence
    // for most of the catalogue and presence for a few.
    private void seedDefaultModuleEntitlements(UUID organizationId, OrganizationSector sector) {
        Set<ModuleCode> defaults = SECTOR_DEFAULT_MODULES.get(sector);
        for (ModuleCode code : ModuleCode.values()) {
            if (code.isFoundation()) continue;
            moduleEntitlementRepository.save(
                    new ModuleEntitlement(organizationId, code, defaults.contains(code)));
        }
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
                    auditEntityId.toString(), null, null);
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

    public record ProvisionOrganizationCommand(
            String slug, String displayName, OrganizationSector sector, List<AdminInput> admins) {
    }

    public record AddAdminsCommand(List<AdminInput> admins) {
    }

    // SADM-US-006's own field list: "name, physical address, operating
    // hours and contact details" — code isn't in the story's prose but is
    // required by the underlying Facility entity/table (existing UNIQUE
    // constraint, predates this story), so it's collected the same way
    // FacilityController's own tenant-side create form already does.
    public record AddClinicCommand(String name, String code, FacilityType type, String address, String phone,
                                    String operatingHours) {
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

    // beforeValue/afterValue are raw JSON text straight from AuditLog's own
    // jsonb columns (AuthService.serializeLoginState()'s own why-note on
    // what actually populates them today) — null for every action that
    // doesn't capture a state snapshot, which is still most of them.
    public record TenantAuditEntryView(
            UUID id, String action, String entityType, String entityId, Instant createdAt, String actorName,
            String beforeValue, String afterValue, String ipAddress, String deviceSignature) {
    }
}
