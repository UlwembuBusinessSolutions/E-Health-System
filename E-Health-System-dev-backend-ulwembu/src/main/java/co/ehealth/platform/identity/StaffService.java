package co.ehealth.platform.identity;

import co.ehealth.platform.core.audit.AuditLogService;
import co.ehealth.platform.core.notification.EmailService;
import co.ehealth.platform.core.security.TemporaryPasswordGenerator;
import co.ehealth.platform.core.tenant.Organization;
import co.ehealth.platform.core.tenant.OrganizationRepository;
import co.ehealth.platform.core.tenant.TenantContext;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class StaffService {

    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final UserComplianceDetailsRepository complianceDetailsRepository;
    private final PasswordEncoder passwordEncoder;
    private final AuditLogService auditLogService;
    // core.tenant/core.notification, not identity's own — same "shared
    // core package, fair game across modules" reasoning already true of
    // AuditLogService above (TenantContext is already used this way
    // elsewhere in this package, e.g. AuthService, StaffPhotoService).
    private final OrganizationRepository organizationRepository;
    private final EmailService emailService;
    private final TemporaryPasswordGenerator temporaryPasswordGenerator;
    private final Clock clock;

    public StaffService(UserRepository userRepository, RoleRepository roleRepository,
                         UserComplianceDetailsRepository complianceDetailsRepository,
                         PasswordEncoder passwordEncoder, AuditLogService auditLogService,
                         OrganizationRepository organizationRepository, EmailService emailService,
                         TemporaryPasswordGenerator temporaryPasswordGenerator, Clock clock) {
        this.userRepository = userRepository;
        this.roleRepository = roleRepository;
        this.complianceDetailsRepository = complianceDetailsRepository;
        this.passwordEncoder = passwordEncoder;
        this.auditLogService = auditLogService;
        this.organizationRepository = organizationRepository;
        this.emailService = emailService;
        this.temporaryPasswordGenerator = temporaryPasswordGenerator;
        this.clock = clock;
    }

    // Called only by OrganizationProvisioningService (the platform module)
    // — the one legitimate cross-module case in this codebase, routed
    // through this service rather than platform reaching into
    // UserRepository/RoleRepository directly, per the "no module calls
    // another module's repository directly, only its service" rule from
    // the Phase 1 dev brief. Deliberately not createStaff(): an org admin
    // has no facility, no HR profile fields, and is always assigned the
    // seeded ORG_ADMIN role rather than an admin-chosen one — reusing
    // createStaff() here would mean passing a wall of nulls through a
    // method shaped for a completely different form.
    @Transactional
    public User createOrgAdmin(String firstName, String lastName, String employeeNumber, String email,
                                String contactNumber, Gender gender, String temporaryPassword) {
        requireUnique("email", userRepository.existsByEmail(email));
        requireUnique("employeeNumber", userRepository.existsByEmployeeNumber(employeeNumber));
        requireUnique("contactNumber", userRepository.existsByContactNumber(contactNumber));

        Role orgAdminRole = roleRepository.findByName("ORG_ADMIN")
                .orElseThrow(() -> new IllegalStateException("ORG_ADMIN role missing — seed migration didn't run"));

        User admin = new User(employeeNumber, email, firstName, lastName, contactNumber,
                passwordEncoder.encode(temporaryPassword), null, gender);
        userRepository.save(admin);
        userRepository.assignRole(admin.getId(), orgAdminRole.getId(), null);
        return admin;
    }

    // The read half of OrganizationProvisioningService.listAdmins() — never
    // the full User entity, same passwordHash-leak reasoning as StaffSummary
    // below.
    public List<AdminSummary> listOrgAdmins() {
        return userRepository.findByRoleName("ORG_ADMIN").stream()
                .map(AdminSummary::from)
                .toList();
    }

    // OrganizationProvisioningService.listTenantAuditLog()'s name lookup —
    // audit_log rows only ever store a bare userId (AuditLog.getUserId()),
    // and that module has no business reaching into UserRepository
    // directly to turn ids into names, per the same module-boundary rule
    // every other cross-module read here already follows. One bulk lookup,
    // not one query per audit row.
    public Map<UUID, String> resolveUserNames(Set<UUID> userIds) {
        return userRepository.findAllById(userIds).stream()
                .collect(Collectors.toMap(User::getId, u -> u.getFirstName() + " " + u.getLastName()));
    }

    // The write half of OrganizationProvisioningService.removeAdmin() — the
    // actual fix for "an admin is locked out or has left, and nobody else
    // has platform access to remove them." Revokes the role only; doesn't
    // touch UserStatus or password, unlike offboardStaff() below. Someone
    // stepping down from admin duties is not the same event as someone
    // leaving the organization, and conflating the two here would mean this
    // one platform-side lever could only ever mean the more destructive of
    // the two actions.
    @Transactional
    public void revokeOrgAdminRole(UUID userId) {
        Role orgAdminRole = roleRepository.findByName("ORG_ADMIN")
                .orElseThrow(() -> new IllegalStateException("ORG_ADMIN role missing — seed migration didn't run"));

        List<User> currentAdmins = userRepository.findByRoleName("ORG_ADMIN");
        boolean isCurrentlyAdmin = currentAdmins.stream().anyMatch(u -> u.getId().equals(userId));
        if (!isCurrentlyAdmin) {
            throw new NotAnOrgAdminException("This user does not currently hold the ORG_ADMIN role.");
        }
        // The safety check: every endpoint that could hand ORG_ADMIN back
        // to someone — addAdmins, and this method's own caller — requires
        // already being ORG_ADMIN (platform-operator-authenticated, in
        // addAdmins' case) or ORG_ADMIN itself. Removing the last one would
        // leave the organization with no path back in short of direct
        // database access.
        if (currentAdmins.size() <= 1) {
            throw new LastRemainingAdminException("Cannot remove the organization's last remaining admin.");
        }

        userRepository.removeRole(userId, orgAdminRole.getId());
    }

    public record AdminSummary(UUID userId, String email, String firstName, String lastName, UserStatus status) {
        static AdminSummary from(User u) {
            return new AdminSummary(u.getId(), u.getEmail(), u.getFirstName(), u.getLastName(), u.getStatus());
        }
    }

    // The tenant app's own staff roster — the read half this org has never
    // had (createStaff() below is the only staff endpoint that existed
    // before the real app shell needed a list to show). One findRoleNames()
    // call per user rather than a bulk join: a tenant's own staff count is
    // realistically dozens, not thousands, and there's no existing bulk
    // variant of that native query to reuse without adding one purely for
    // this. Revisit if a real org's roster ever grows large enough for that
    // to matter.
    public List<StaffRosterEntry> listStaff() {
        return userRepository.findAll().stream()
                .map(u -> new StaffRosterEntry(u.getId(), u.getEmployeeNumber(), u.getFirstName(), u.getLastName(),
                        u.getEmail(), u.getContactNumber(), userRepository.findRoleNames(u.getId()),
                        u.getFacilityId(), u.getStatus(), u.getLastLoginAt()))
                .toList();
    }

    public record StaffRosterEntry(UUID id, String employeeNumber, String firstName, String lastName, String email,
                                    String contactNumber, List<String> roles, UUID facilityId, UserStatus status,
                                    Instant lastLoginAt) {
    }

    // PHRM-US-009: "Restrict prescribing/dispensing to licensed users ...
    // expired licence auto-suspends capability." This codebase's only
    // professional-registration data is the three number/expiry pairs
    // AddStaffScreen already collects (sanc/hpcsa/sapc, V7__staff_hr_and_compliance.sql) —
    // no separate "role permits this action" table exists, so "licensed"
    // here means exactly "holds a present, non-expired registration of the
    // right kind," checked fresh on every call rather than cached: a
    // licence expiring between logins should take effect immediately, not
    // wait for the next login's JWT to reflect it. hpcsaNumber and
    // sancNumber are treated as equally valid prescribing credentials
    // (doctors register under HPCSA, many nurses under SANC) — this
    // codebase has no finer-grained "which profession prescribes what"
    // rule to enforce beyond "some real, current registration exists."
    public LicenseStatus getLicenseStatus(UUID userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("Unknown staff member"));
        LocalDate today = LocalDate.now(clock);
        boolean hpcsaValid = user.getHpcsaNumber() != null && user.getHpcsaExpiryDate() != null
                && !user.getHpcsaExpiryDate().isBefore(today);
        boolean sancValid = user.getSancNumber() != null && user.getSancExpiryDate() != null
                && !user.getSancExpiryDate().isBefore(today);
        boolean sapcValid = user.getSapcNumber() != null && user.getSapcExpiryDate() != null
                && !user.getSapcExpiryDate().isBefore(today);
        return new LicenseStatus(hpcsaValid || sancValid, sapcValid);
    }

    public record LicenseStatus(boolean canPrescribe, boolean canDispense) {
    }

    // Direct creation, not request-and-approve: an org admin fills every
    // field themselves — mirrors the legacy Staff/insertstaff form this
    // replaces — and the account is usable immediately. mustChangePassword
    // defaults true on User's constructor, so the temp password the admin
    // types can't become a standing credential without the staff member
    // replacing it first. noRollbackFor is load-bearing, same reasoning as
    // AuthService.login(): requireAssignableRole() writes the AUDT security
    // event first and then throws RoleEscalationException to reject the
    // request — without this, the default rollback-on-unchecked-exception
    // would discard that audit row on every blocked attempt.
    @Transactional(noRollbackFor = RoleEscalationException.class)
    public User createStaff(CreateStaffCommand cmd, UUID creatingAdminId) {
        requireUnique("employeeNumber", userRepository.existsByEmployeeNumber(cmd.employeeNumber()));
        requireUnique("email", userRepository.existsByEmail(cmd.email()));
        requireUnique("contactNumber", userRepository.existsByContactNumber(cmd.contactNumber()));
        if (cmd.idNumber() != null) {
            requireUnique("idNumber", userRepository.existsByIdNumber(cmd.idNumber()));
        }
        if (cmd.sancNumber() != null) {
            requireUnique("sancNumber", userRepository.existsBySancNumber(cmd.sancNumber()));
        }
        if (cmd.hpcsaNumber() != null) {
            requireUnique("hpcsaNumber", userRepository.existsByHpcsaNumber(cmd.hpcsaNumber()));
        }
        if (cmd.sapcNumber() != null) {
            requireUnique("sapcNumber", userRepository.existsBySapcNumber(cmd.sapcNumber()));
        }
        if (cmd.managerId() != null && !userRepository.existsById(cmd.managerId())) {
            throw new IllegalArgumentException("Unknown manager");
        }
        requireAssignableRole(cmd.roleId(), creatingAdminId, cmd.facilityId());

        User user = new User(cmd.employeeNumber(), cmd.email(), cmd.firstName(), cmd.lastName(),
                cmd.contactNumber(), passwordEncoder.encode(cmd.temporaryPassword()), cmd.facilityId(), cmd.gender());
        user.setIdNumber(cmd.idNumber());
        user.setEmploymentStartDate(cmd.employmentStartDate());
        user.setEmploymentType(cmd.employmentType());
        user.setManagerId(cmd.managerId());
        user.setDepartment(cmd.department());
        user.setDesignation(cmd.designation());
        user.setDateOfBirth(cmd.dateOfBirth());
        user.setSancNumber(cmd.sancNumber());
        user.setSancExpiryDate(cmd.sancExpiryDate());
        user.setHpcsaNumber(cmd.hpcsaNumber());
        user.setHpcsaExpiryDate(cmd.hpcsaExpiryDate());
        user.setSapcNumber(cmd.sapcNumber());
        user.setSapcExpiryDate(cmd.sapcExpiryDate());
        // No profilePhotoUrl here — StaffPhotoService's deterministic S3 key
        // is keyed on the user's id, which doesn't exist until save() below
        // runs. A photo is always a follow-up call to POST .../photo.
        user.setEmergencyContactName(cmd.emergencyContactName());
        user.setEmergencyContactRelationship(cmd.emergencyContactRelationship());
        user.setEmergencyContactPhone(cmd.emergencyContactPhone());
        userRepository.save(user);

        userRepository.assignRole(user.getId(), cmd.roleId(), cmd.facilityId());

        // The primary facility plus every additional one a staff member
        // works at. cmd.additionalFacilityIds() is never null — the
        // controller defaults it to an empty list, not omits it.
        userRepository.assignFacility(user.getId(), cmd.facilityId());
        for (UUID additionalFacilityId : cmd.additionalFacilityIds()) {
            userRepository.assignFacility(user.getId(), additionalFacilityId);
        }

        auditLogService.append(creatingAdminId, cmd.facilityId(), "STAFF_CREATED",
                "User", user.getId().toString(), null, null);

        // Previously nothing notified a new staff member at all — only
        // org-admin accounts (OrganizationProvisioningService) sent an
        // email. TenantContext is already set to this org's schema for the
        // whole request (TenantFilter), so the org row is one lookup away;
        // a failed send is swallowed inside EmailService and never affects
        // account creation itself, same as the admin path.
        organizationRepository.findBySchemaName(TenantContext.getCurrentTenant())
                .ifPresent(organization -> emailService.sendStaffAccountCreatedEmail(
                        user.getEmail(), user.getFirstName(), organization.getDisplayName(), organization.getSlug(),
                        user.getEmployeeNumber(), cmd.temporaryPassword()));

        return user;
    }

    // employmentEndDate is deliberately absent from CreateStaffCommand
    // above — nobody sets a leaving date while hiring someone. This is its
    // own operation, run once a staff member is actually leaving: stamps
    // the date and disables login in the same transaction, so there's no
    // window where the account is disabled but the record doesn't yet say
    // why, or vice versa.
    @Transactional
    public void offboardStaff(UUID userId, LocalDate employmentEndDate, UUID actingAdminId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("Unknown staff member"));
        user.setEmploymentEndDate(employmentEndDate);
        user.setStatus(UserStatus.DISABLED);
        userRepository.save(user);
        auditLogService.append(actingAdminId, user.getFacilityId(), "STAFF_OFFBOARDED",
                "User", userId.toString(), null, null);
    }

    // Admin-triggered, unlike the self-service /api/v1/auth/password-reset/**
    // flow (PasswordResetService) — this is "an admin generates and hands
    // over a new working password" for someone who's locked out or simply
    // needs a reset done for them, not "I forgot my password and can prove
    // it's me via a 6-digit code sent to my own address." Uses
    // adminResetPassword() rather than setPasswordHash() specifically so
    // mustChangePassword ends up true — see User.adminResetPassword()'s own
    // why-note. Same "capture-to-file, then attempt real SMTP" delivery
    // path as every other account email.
    @Transactional
    public String resetPassword(UUID userId, UUID actingAdminId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("Unknown staff member"));
        String temporaryPassword = temporaryPasswordGenerator.generate();
        user.adminResetPassword(passwordEncoder.encode(temporaryPassword));
        userRepository.save(user);

        auditLogService.append(actingAdminId, user.getFacilityId(), "STAFF_PASSWORD_RESET",
                "User", userId.toString(), null, null);

        organizationRepository.findBySchemaName(TenantContext.getCurrentTenant())
                .ifPresent(organization -> emailService.sendStaffPasswordResetEmail(
                        user.getEmail(), user.getFirstName(), organization.getDisplayName(),
                        organization.getSlug(), temporaryPassword));

        return temporaryPassword;
    }

    // The write half of "ability to disable the user" — a plain suspend/
    // reactivate lever, deliberately kept separate from offboardStaff()
    // above: that one means "this person left the organization" (stamps
    // employmentEndDate, a real HR fact that shouldn't be implied by a
    // reversible admin action) — this means "this account can't sign in
    // right now," full stop, and never touches employmentEndDate either
    // way. Guards against disabling an organization's last remaining
    // ORG_ADMIN, same check and same reasoning as revokeOrgAdminRole()'s
    // own guard — every path back to having one requires already being one.
    @Transactional
    public void setEnabled(UUID userId, boolean enabled, UUID actingAdminId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("Unknown staff member"));
        if (!enabled && userRepository.findRoleNames(userId).contains("ORG_ADMIN")) {
            List<User> currentAdmins = userRepository.findByRoleName("ORG_ADMIN");
            if (currentAdmins.size() <= 1) {
                throw new LastRemainingAdminException("Cannot disable the organization's last remaining admin.");
            }
        }

        user.setStatus(enabled ? UserStatus.ACTIVE : UserStatus.DISABLED);
        userRepository.save(user);

        auditLogService.append(actingAdminId, user.getFacilityId(),
                enabled ? "STAFF_ENABLED" : "STAFF_DISABLED", "User", userId.toString(), null, null);
    }

    // The admin-triggered escape hatch for the lockout AuthService.login()
    // enforces after MAX_FAILED_ATTEMPTS — normally self-clears after
    // LOCKOUT_DURATION, but a staff member who needs back in sooner has no
    // self-service path (they're locked out of the one flow that would let
    // them prove who they are). No-ops rather than erroring if the account
    // isn't currently LOCKED, since retrying this call is harmless.
    @Transactional
    public void unlockAccount(UUID userId, UUID actingAdminId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("Unknown staff member"));
        if (user.getStatus() != UserStatus.LOCKED) {
            return;
        }

        user.unlock();
        userRepository.save(user);

        auditLogService.append(actingAdminId, user.getFacilityId(), "STAFF_UNLOCKED",
                "User", userId.toString(), null, null);
    }

    // Separate from createStaff() on purpose. A background check result
    // typically arrives days or weeks after someone starts, not at
    // creation time, and race/disability disclosure is voluntary and can
    // change or arrive later too. First call creates the row; later calls
    // update the same row rather than erroring on "already exists" — and
    // each field only overwrites if this call actually sent it, so a call
    // that only carries a background-check result doesn't null out
    // race/disability data a previous call already recorded.
    @Transactional
    public void recordComplianceDetails(UUID userId, RecordComplianceCommand cmd, UUID recordingAdminId) {
        if (!userRepository.existsById(userId)) {
            throw new IllegalArgumentException("Unknown staff member");
        }
        UserComplianceDetails details = complianceDetailsRepository.findById(userId)
                .orElseGet(() -> new UserComplianceDetails(userId));
        if (cmd.race() != null) {
            details.setRace(cmd.race());
        }
        if (cmd.disabilityStatus() != null) {
            details.setDisabilityStatus(cmd.disabilityStatus());
        }
        if (cmd.backgroundCheckDate() != null) {
            details.setBackgroundCheckDate(cmd.backgroundCheckDate());
        }
        if (cmd.backgroundCheckStatus() != null) {
            details.setBackgroundCheckStatus(cmd.backgroundCheckStatus());
        }
        if (cmd.occupationalHealthClearanceDate() != null) {
            details.setOccupationalHealthClearanceDate(cmd.occupationalHealthClearanceDate());
        }
        complianceDetailsRepository.save(details);
        auditLogService.append(recordingAdminId, null, "STAFF_COMPLIANCE_RECORDED",
                "UserComplianceDetails", userId.toString(), null, null);
    }

    private void requireUnique(String field, boolean alreadyTaken) {
        if (alreadyTaken) {
            throw new DuplicateFieldException(field, "This " + field + " is already in use.");
        }
    }

    // The structural guard SADM's security architecture requires: an org
    // admin's roleId comes straight from a request body, and
    // /api/v1/roles' own dropdown (RoleController) already can't offer a
    // platform-reserved role because none is ever seeded into a tenant's
    // roles table — but a crafted request skips that dropdown entirely and
    // sends a roleId directly, so the same guarantee has to be enforced
    // here too, not just at the UI layer. Every rejection is audit-logged
    // before it's thrown, since GlobalExceptionHandler's RoleEscalationException
    // mapping only produces the HTTP response, not the AUDT trail.
    private void requireAssignableRole(UUID roleId, UUID actingAdminId, UUID facilityId) {
        Role role = roleRepository.findById(roleId).orElse(null);
        if (role == null || ReservedRoleNames.isReserved(role.getName())) {
            auditLogService.append(actingAdminId, facilityId, "ROLE_ESCALATION_ATTEMPT_BLOCKED",
                    "Role", roleId.toString(), null, null);
            throw new RoleEscalationException(
                    "This role cannot be assigned from a tenant context.");
        }
    }

    public record CreateStaffCommand(
            String firstName, String lastName, String employeeNumber, String idNumber, String email,
            String contactNumber, Gender gender, LocalDate dateOfBirth, LocalDate employmentStartDate,
            EmploymentType employmentType, UUID managerId, UUID facilityId, List<UUID> additionalFacilityIds,
            String department, String designation, UUID roleId, String sancNumber, LocalDate sancExpiryDate,
            String hpcsaNumber, LocalDate hpcsaExpiryDate, String sapcNumber, LocalDate sapcExpiryDate,
            String emergencyContactName, String emergencyContactRelationship,
            String emergencyContactPhone, String temporaryPassword) {
    }

    public record RecordComplianceCommand(
            String race, String disabilityStatus, LocalDate backgroundCheckDate,
            BackgroundCheckStatus backgroundCheckStatus, LocalDate occupationalHealthClearanceDate) {
    }
}
