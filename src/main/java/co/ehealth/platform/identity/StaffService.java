package co.ehealth.platform.identity;

import co.ehealth.platform.core.audit.AuditLogService;
import co.ehealth.platform.core.notification.EmailService;
import co.ehealth.platform.core.tenant.Organization;
import co.ehealth.platform.core.tenant.OrganizationRepository;
import co.ehealth.platform.core.tenant.TenantContext;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

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

    public StaffService(UserRepository userRepository, RoleRepository roleRepository,
                         UserComplianceDetailsRepository complianceDetailsRepository,
                         PasswordEncoder passwordEncoder, AuditLogService auditLogService,
                         OrganizationRepository organizationRepository, EmailService emailService) {
        this.userRepository = userRepository;
        this.roleRepository = roleRepository;
        this.complianceDetailsRepository = complianceDetailsRepository;
        this.passwordEncoder = passwordEncoder;
        this.auditLogService = auditLogService;
        this.organizationRepository = organizationRepository;
        this.emailService = emailService;
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

    public record AdminSummary(UUID userId, String email, String firstName, String lastName) {
        static AdminSummary from(User u) {
            return new AdminSummary(u.getId(), u.getEmail(), u.getFirstName(), u.getLastName());
        }
    }

    // Direct creation, not request-and-approve: an org admin fills every
    // field themselves — mirrors the legacy Staff/insertstaff form this
    // replaces — and the account is usable immediately. mustChangePassword
    // defaults true on User's constructor, so the temp password the admin
    // types can't become a standing credential without the staff member
    // replacing it first.
    @Transactional
    public User createStaff(CreateStaffCommand cmd, UUID creatingAdminId, String ipAddress) {
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
                "User", user.getId().toString(), null, null, ipAddress);

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
    public void offboardStaff(UUID userId, LocalDate employmentEndDate, UUID actingAdminId, String ipAddress) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("Unknown staff member"));
        user.setEmploymentEndDate(employmentEndDate);
        user.setStatus(UserStatus.DISABLED);
        userRepository.save(user);
        auditLogService.append(actingAdminId, user.getFacilityId(), "STAFF_OFFBOARDED",
                "User", userId.toString(), null, null, ipAddress);
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
    public void recordComplianceDetails(UUID userId, RecordComplianceCommand cmd, UUID recordingAdminId,
                                         String ipAddress) {
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
                "UserComplianceDetails", userId.toString(), null, null, ipAddress);
    }

    private void requireUnique(String field, boolean alreadyTaken) {
        if (alreadyTaken) {
            throw new DuplicateFieldException(field, "This " + field + " is already in use.");
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
