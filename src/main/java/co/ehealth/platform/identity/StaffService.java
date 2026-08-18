package co.ehealth.platform.identity;

import co.ehealth.platform.core.audit.AuditLogService;
import co.ehealth.platform.core.notification.EmailService;
import co.ehealth.platform.core.tenant.OrganizationRepository;
import co.ehealth.platform.core.tenant.TenantContext;
import co.ehealth.platform.facility.FacilityRepository;
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
    private final FacilityRepository facilityRepository;
    private final UserComplianceDetailsRepository complianceDetailsRepository;
    private final PasswordEncoder passwordEncoder;
    private final AuditLogService auditLogService;
    private final OrganizationRepository organizationRepository;
    private final EmailService emailService;

    public StaffService(
            UserRepository userRepository,
            RoleRepository roleRepository,
            FacilityRepository facilityRepository,
            UserComplianceDetailsRepository complianceDetailsRepository,
            PasswordEncoder passwordEncoder,
            AuditLogService auditLogService,
            OrganizationRepository organizationRepository,
            EmailService emailService
    ) {
        this.userRepository = userRepository;
        this.roleRepository = roleRepository;
        this.facilityRepository = facilityRepository;
        this.complianceDetailsRepository = complianceDetailsRepository;
        this.passwordEncoder = passwordEncoder;
        this.auditLogService = auditLogService;
        this.organizationRepository = organizationRepository;
        this.emailService = emailService;
    }

    // Called only by OrganizationProvisioningService (the platform module).
    @Transactional
    public User createOrgAdmin(
            String firstName,
            String lastName,
            String employeeNumber,
            String email,
            String contactNumber,
            Gender gender,
            String temporaryPassword
    ) {
        requireUnique("email", userRepository.existsByEmail(email));
        requireUnique(
                "employeeNumber",
                userRepository.existsByEmployeeNumber(employeeNumber)
        );
        requireUnique(
                "contactNumber",
                userRepository.existsByContactNumber(contactNumber)
        );

        Role orgAdminRole = roleRepository.findByName("ORG_ADMIN")
                .orElseThrow(() ->
                        new IllegalStateException(
                                "ORG_ADMIN role missing — seed migration didn't run"
                        )
                );

        User admin = new User(
                employeeNumber,
                email,
                firstName,
                lastName,
                contactNumber,
                passwordEncoder.encode(temporaryPassword),
                null,
                gender
        );

        userRepository.save(admin);

        userRepository.assignRole(
                admin.getId(),
                orgAdminRole.getId(),
                null
        );

        return admin;
    }

    public List<AdminSummary> listOrgAdmins() {
        return userRepository.findByRoleName("ORG_ADMIN")
                .stream()
                .map(AdminSummary::from)
                .toList();
    }

    @Transactional
    public void revokeOrgAdminRole(UUID userId) {

        Role orgAdminRole = roleRepository.findByName("ORG_ADMIN")
                .orElseThrow(() ->
                        new IllegalStateException(
                                "ORG_ADMIN role missing — seed migration didn't run"
                        )
                );

        List<User> currentAdmins =
                userRepository.findByRoleName("ORG_ADMIN");

        boolean isCurrentlyAdmin =
                currentAdmins.stream()
                        .anyMatch(u -> u.getId().equals(userId));

        if (!isCurrentlyAdmin) {
            throw new NotAnOrgAdminException(
                    "This user does not currently hold the ORG_ADMIN role."
            );
        }

        if (currentAdmins.size() <= 1) {
            throw new LastRemainingAdminException(
                    "Cannot remove the organization's last remaining admin."
            );
        }

        userRepository.removeRole(
                userId,
                orgAdminRole.getId()
        );
    }

    public record AdminSummary(
            UUID userId,
            String email,
            String firstName,
            String lastName
    ) {
        static AdminSummary from(User u) {
            return new AdminSummary(
                    u.getId(),
                    u.getEmail(),
                    u.getFirstName(),
                    u.getLastName()
            );
        }
    }

    // Direct staff creation.
    @Transactional
    public User createStaff(
            CreateStaffCommand cmd,
            UUID creatingAdminId,
            String ipAddress
    ) {

        // These lookups are deliberately performed through tenant-scoped
        // repositories before the assignment write. A role or facility ID
        // from another organization is therefore indistinguishable from an
        // unknown ID and can never become a cross-tenant user_roles entry.
        if (!roleRepository.existsById(cmd.roleId())) {
            throw new IllegalArgumentException("Unknown role");
        }
        if (!facilityRepository.existsById(cmd.facilityId())) {
            throw new IllegalArgumentException("Unknown facility");
        }
        for (UUID additionalFacilityId : cmd.additionalFacilityIds()) {
            if (!facilityRepository.existsById(additionalFacilityId)) {
                throw new IllegalArgumentException("Unknown facility");
            }
        }

        requireUnique(
                "employeeNumber",
                userRepository.existsByEmployeeNumber(
                        cmd.employeeNumber()
                )
        );

        requireUnique(
                "email",
                userRepository.existsByEmail(cmd.email())
        );

        requireUnique(
                "contactNumber",
                userRepository.existsByContactNumber(
                        cmd.contactNumber()
                )
        );

        if (cmd.idNumber() != null) {
            requireUnique(
                    "idNumber",
                    userRepository.existsByIdNumber(cmd.idNumber())
            );
        }

        if (cmd.sancNumber() != null) {
            requireUnique(
                    "sancNumber",
                    userRepository.existsBySancNumber(cmd.sancNumber())
            );
        }

        if (cmd.hpcsaNumber() != null) {
            requireUnique(
                    "hpcsaNumber",
                    userRepository.existsByHpcsaNumber(cmd.hpcsaNumber())
            );
        }

        if (cmd.sapcNumber() != null) {
            requireUnique(
                    "sapcNumber",
                    userRepository.existsBySapcNumber(cmd.sapcNumber())
            );
        }

        if (cmd.managerId() != null
                && !userRepository.existsById(cmd.managerId())) {
            throw new IllegalArgumentException("Unknown manager");
        }

        User user = new User(
                cmd.employeeNumber(),
                cmd.email(),
                cmd.firstName(),
                cmd.lastName(),
                cmd.contactNumber(),
                passwordEncoder.encode(cmd.temporaryPassword()),
                cmd.facilityId(),
                cmd.gender()
        );

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

        user.setEmergencyContactName(
                cmd.emergencyContactName()
        );

        user.setEmergencyContactRelationship(
                cmd.emergencyContactRelationship()
        );

        user.setEmergencyContactPhone(
                cmd.emergencyContactPhone()
        );

        userRepository.save(user);

        userRepository.assignRole(
                user.getId(),
                cmd.roleId(),
                cmd.facilityId()
        );

        userRepository.assignFacility(
                user.getId(),
                cmd.facilityId()
        );

        for (UUID additionalFacilityId :
                cmd.additionalFacilityIds()) {

            userRepository.assignFacility(
                    user.getId(),
                    additionalFacilityId
            );
        }

        // 8th argument = IP address of the administrator
        // who created the staff member.
        auditLogService.append(
                creatingAdminId,
                cmd.facilityId(),
                "STAFF_CREATED",
                "User",
                user.getId().toString(),
                null,
                null,
                ipAddress
        );

        organizationRepository
                .findBySchemaName(
                        TenantContext.getCurrentTenant()
                )
                .ifPresent(
                        organization ->
                                emailService.sendStaffAccountCreatedEmail(
                                        user.getEmail(),
                                        user.getFirstName(),
                                        organization.getDisplayName(),
                                        organization.getSlug(),
                                        user.getEmployeeNumber(),
                                        cmd.temporaryPassword()
                                )
                );

        return user;
    }

    // Offboards an existing staff member.
    @Transactional
    public void offboardStaff(
            UUID userId,
            LocalDate employmentEndDate,
            UUID actingAdminId,
            String ipAddress
    ) {

        User user = userRepository
                .findById(userId)
                .orElseThrow(() ->
                        new IllegalArgumentException(
                                "Unknown staff member"
                        )
                );

        user.setEmploymentEndDate(employmentEndDate);
        user.setStatus(UserStatus.DISABLED);

        userRepository.save(user);

        // 8th argument = IP address of the administrator
        // who performed the offboarding.
        auditLogService.append(
                actingAdminId,
                user.getFacilityId(),
                "STAFF_OFFBOARDED",
                "User",
                userId.toString(),
                null,
                null,
                ipAddress
        );
    }

    // Records staff compliance details.
    @Transactional
    public void recordComplianceDetails(
            UUID userId,
            RecordComplianceCommand cmd,
            UUID recordingAdminId,
            String ipAddress
    ) {

        if (!userRepository.existsById(userId)) {
            throw new IllegalArgumentException(
                    "Unknown staff member"
            );
        }

        UserComplianceDetails details =
                complianceDetailsRepository
                        .findById(userId)
                        .orElseGet(
                                () -> new UserComplianceDetails(userId)
                        );

        if (cmd.race() != null) {
            details.setRace(cmd.race());
        }

        if (cmd.disabilityStatus() != null) {
            details.setDisabilityStatus(
                    cmd.disabilityStatus()
            );
        }

        if (cmd.backgroundCheckDate() != null) {
            details.setBackgroundCheckDate(
                    cmd.backgroundCheckDate()
            );
        }

        if (cmd.backgroundCheckStatus() != null) {
            details.setBackgroundCheckStatus(
                    cmd.backgroundCheckStatus()
            );
        }

        if (cmd.occupationalHealthClearanceDate() != null) {
            details.setOccupationalHealthClearanceDate(
                    cmd.occupationalHealthClearanceDate()
            );
        }

        complianceDetailsRepository.save(details);

        // 8th argument = IP address of the administrator
        // who recorded the compliance information.
        auditLogService.append(
                recordingAdminId,
                null,
                "STAFF_COMPLIANCE_RECORDED",
                "UserComplianceDetails",
                userId.toString(),
                null,
                null,
                ipAddress
        );
    }

    private void requireUnique(
            String field,
            boolean alreadyTaken
    ) {
        if (alreadyTaken) {
            throw new DuplicateFieldException(
                    field,
                    "This " + field + " is already in use."
            );
        }
    }

    public record CreateStaffCommand(
            String firstName,
            String lastName,
            String employeeNumber,
            String idNumber,
            String email,
            String contactNumber,
            Gender gender,
            LocalDate dateOfBirth,
            LocalDate employmentStartDate,
            EmploymentType employmentType,
            UUID managerId,
            UUID facilityId,
            List<UUID> additionalFacilityIds,
            String department,
            String designation,
            UUID roleId,
            String sancNumber,
            LocalDate sancExpiryDate,
            String hpcsaNumber,
            LocalDate hpcsaExpiryDate,
            String sapcNumber,
            LocalDate sapcExpiryDate,
            String emergencyContactName,
            String emergencyContactRelationship,
            String emergencyContactPhone,
            String temporaryPassword
    ) {
    }

    public record RecordComplianceCommand(
            String race,
            String disabilityStatus,
            LocalDate backgroundCheckDate,
            BackgroundCheckStatus backgroundCheckStatus,
            LocalDate occupationalHealthClearanceDate
    ) {
    }
}
