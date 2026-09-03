package co.ehealth.platform.platform;

import co.ehealth.platform.core.security.AuthenticatedPrincipal;
import co.ehealth.platform.core.tenant.Organization;
import co.ehealth.platform.core.tenant.OrganizationRepository;
import co.ehealth.platform.core.tenant.OrganizationSector;
import co.ehealth.platform.core.tenant.TenantContext;
import co.ehealth.platform.facility.Facility;
import co.ehealth.platform.facility.FacilityService;
import co.ehealth.platform.facility.FacilityType;
import co.ehealth.platform.identity.EmploymentType;
import co.ehealth.platform.identity.Gender;
import co.ehealth.platform.identity.Role;
import co.ehealth.platform.identity.RoleRepository;
import co.ehealth.platform.identity.StaffService;
import co.ehealth.platform.identity.User;
import co.ehealth.platform.patient.PatientService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.core.annotation.Order;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

// A freshly `docker-compose up`'d environment otherwise has zero
// organizations — every screen in the app is an empty state until someone
// hand-provisions a tenant through the platform console first. This gives a
// new developer one ready-made, populated tenant to actually click around
// in, the same way PlatformOperatorBootstrap (@Order(1)) exists so there's
// at least one platform-operator login. @Order(2) — runs after that, since
// provisioning needs a real operator id to attribute the platform_audit_log
// rows to.
//
// Idempotent by construction (existsBySlug check below), same as
// PlatformOperatorBootstrap's existsByEmail — safe to boot against an
// already-seeded database (a restart, not just a first run) without erroring
// or creating a second copy.
@Component
@Profile("dev")
@Order(2)
public class DevSeedDataRunner implements ApplicationRunner {

    private static final String DEMO_SLUG = "demo-clinic";

    private final OrganizationRepository organizationRepository;
    private final OrganizationProvisioningService provisioningService;
    private final PlatformOperatorRepository platformOperatorRepository;
    private final FacilityService facilityService;
    private final RoleRepository roleRepository;
    private final StaffService staffService;
    private final PatientService patientService;
    private final String bootstrapOperatorEmail;

    public DevSeedDataRunner(OrganizationRepository organizationRepository,
                              OrganizationProvisioningService provisioningService,
                              PlatformOperatorRepository platformOperatorRepository,
                              FacilityService facilityService, RoleRepository roleRepository,
                              StaffService staffService, PatientService patientService,
                              @Value("${app.platform.bootstrap.email}") String bootstrapOperatorEmail) {
        this.organizationRepository = organizationRepository;
        this.provisioningService = provisioningService;
        this.platformOperatorRepository = platformOperatorRepository;
        this.facilityService = facilityService;
        this.roleRepository = roleRepository;
        this.staffService = staffService;
        this.patientService = patientService;
        this.bootstrapOperatorEmail = bootstrapOperatorEmail;
    }

    @Override
    public void run(ApplicationArguments args) {
        if (organizationRepository.existsBySlug(DEMO_SLUG)) {
            return;
        }

        // PlatformOperatorBootstrap (@Order(1)) has already run by this
        // point and guarantees this row exists — same assumption
        // provisionOrganization()'s own actingOperatorId param makes for
        // every real platform-operator-initiated call.
        UUID operatorId = platformOperatorRepository.findByEmail(bootstrapOperatorEmail)
                .orElseThrow(() -> new IllegalStateException(
                        "Platform bootstrap operator missing — PlatformOperatorBootstrap didn't run"))
                .getId();

        var provisioned = provisioningService.provisionOrganization(
                new OrganizationProvisioningService.ProvisionOrganizationCommand(
                        DEMO_SLUG, "Demo Community Clinic", OrganizationSector.PUBLIC,
                        List.of(new OrganizationProvisioningService.AdminInput(
                                "Naledi", "Dlamini", "EMP-0001", "admin@democlinic.example",
                                "+27821234501", Gender.FEMALE))),
                operatorId);

        Organization organization = organizationRepository.findById(provisioned.organizationId()).orElseThrow();
        TenantContext.setCurrentTenant(organization.getSchemaName());
        try {
            seedTenantData(provisioned.admins().get(0).userId());
        } finally {
            TenantContext.clear();
        }
    }

    private void seedTenantData(UUID adminUserId) {
        Facility mainClinic = facilityService.create("Demo Main Clinic", "DEMO-01", FacilityType.CLINIC,
                "12 Cradle Street, Johannesburg", "+27115550101", "Mon-Fri 07:00-17:00");
        Facility satelliteClinic = facilityService.create("Demo Satellite Clinic", "DEMO-02", FacilityType.CLINIC,
                "44 Baobab Avenue, Soweto", "+27115550102", "Mon-Fri 08:00-16:00");

        UUID doctorId = createStaffMember(mainClinic.getId(), "Doctor", "Sipho", "Mahlangu",
                "EMP-1001", "8501015800083", "s.mahlangu@democlinic.example", "+27821234502",
                Gender.MALE, LocalDate.of(1985, 1, 1), "Clinical", "General Practitioner", adminUserId);
        createStaffMember(mainClinic.getId(), "Professional Nurse", "Zanele", "Khumalo",
                "EMP-1002", "9003125800084", "z.khumalo@democlinic.example", "+27821234503",
                Gender.FEMALE, LocalDate.of(1990, 3, 12), "Clinical", "Professional Nurse", doctorId);
        createStaffMember(mainClinic.getId(), "Pharmacist", "Rendani", "Nemukula",
                "EMP-1003", "8807205800085", "r.nemukula@democlinic.example", "+27821234504",
                Gender.MALE, LocalDate.of(1988, 7, 20), "Pharmacy", "Pharmacist-in-Charge", adminUserId);
        createStaffMember(mainClinic.getId(), "Queue Marshall", "Palesa", "Mokoena",
                "EMP-1004", "9611085800086", "p.mokoena@democlinic.example", "+27821234505",
                Gender.FEMALE, LocalDate.of(1996, 11, 8), "Reception", "Queue Marshall", adminUserId);
        createStaffMember(mainClinic.getId(), "Admin Staff", "Thabo", "Sithole",
                "EMP-1005", "9204175800087", "t.sithole@democlinic.example", "+27821234506",
                Gender.MALE, LocalDate.of(1992, 4, 17), "Administration", "Admin Officer", adminUserId);
        createStaffMember(satelliteClinic.getId(), "Facility Manager", "Lindiwe", "Zulu",
                "EMP-1006", "8309305800088", "l.zulu@democlinic.example", "+27821234507",
                Gender.FEMALE, LocalDate.of(1983, 9, 30), "Management", "Facility Manager", adminUserId);

        // PatientService.register() is gated by PermissionService (PREG:MANAGE),
        // which reads the acting role straight off SecurityContextHolder —
        // there's no real HTTP request/JWT here to populate that, so a
        // scoped fake principal stands in for one, same "ORG_ADMIN can do
        // everything" grant a real org admin's token would carry
        // (V12__role_permissions.sql). Cleared in the finally block so
        // nothing about this synthetic authentication outlives seeding.
        var principal = new AuthenticatedPrincipal(adminUserId, "dev-seed");
        var authentication = new UsernamePasswordAuthenticationToken(
                principal, null, List.of(new SimpleGrantedAuthority("ROLE_ORG_ADMIN")));
        SecurityContextHolder.getContext().setAuthentication(authentication);
        try {
            // genderSequence alone determines the parsed-back gender
            // (SouthAfricanIdNumber.parse(): <5000 female, >=5000 male) —
            // no separate gender argument to keep in sync with it.
            registerPatient("Andile", "Ngcobo", LocalDate.of(1978, 6, 14), 6001,
                    "18 Vilakazi Street, Soweto", "+27831112201", "Discovery Health", "DH-778812", adminUserId);
            registerPatient("Busisiwe", "Mthembu", LocalDate.of(1995, 2, 3), 1002,
                    "5 Nelson Mandela Drive, Johannesburg", "+27831112202", null, null, adminUserId);
            registerPatient("Kagiso", "Modise", LocalDate.of(1960, 11, 22), 6003,
                    "22 Freedom Square, Soweto", "+27831112203", "Bonitas", "BN-441290", adminUserId);
            registerPatient("Nomvula", "Dube", LocalDate.of(2018, 8, 9), 1004,
                    "9 Baragwanath Road, Soweto", "+27831112204", null, null, adminUserId);
            registerPatient("Sibusiso", "Radebe", LocalDate.of(2001, 4, 30), 6005,
                    "31 Chris Hani Road, Johannesburg", "+27831112205", "Momentum Health", "MH-556723", adminUserId);
        } finally {
            SecurityContextHolder.clearContext();
        }
    }

    private UUID createStaffMember(UUID facilityId, String roleName, String firstName, String lastName,
                                    String employeeNumber, String idNumber, String email, String contactNumber,
                                    Gender gender, LocalDate dateOfBirth, String department, String designation,
                                    UUID managerId) {
        Role role = roleRepository.findByName(roleName)
                .orElseThrow(() -> new IllegalStateException(roleName + " role missing — seed migration didn't run"));
        User user = staffService.createStaff(new StaffService.CreateStaffCommand(
                firstName, lastName, employeeNumber, idNumber, email, contactNumber, gender, dateOfBirth,
                LocalDate.now(), EmploymentType.PERMANENT, managerId, facilityId, List.of(),
                department, designation, role.getId(), null, null, null, null, null, null,
                "Emergency Contact", "Family", "+27831110000", "ChangeMe123!"), managerId);
        return user.getId();
    }

    private void registerPatient(String firstName, String lastName, LocalDate dateOfBirth, int genderSequence,
                                  String address, String contactNumber, String medicalAidProvider,
                                  String medicalAidNumber, UUID registeredByUserId) {
        String idNumber = southAfricanIdNumber(dateOfBirth, genderSequence);
        patientService.register(new PatientService.RegisterPatientCommand(
                firstName, lastName, idNumber, address, contactNumber, medicalAidProvider, medicalAidNumber),
                registeredByUserId);
    }

    // Mirrors SouthAfricanIdNumber.parse()'s own Luhn variant exactly, in
    // reverse — patient registration insists on a checksum-valid number
    // (PREG-US-003), so seed data needs real ones, not arbitrary 13-digit
    // strings. genderSequence must already be on the correct side of 5000
    // (<5000 female, >=5000 male) for the parsed-back gender to match what's
    // passed to registerPatient() above; the citizenship digit is always '0'
    // (SA citizen) and the trailing legacy race digit is always '8' —
    // neither is derived from anything patients actually enter.
    private static String southAfricanIdNumber(LocalDate dateOfBirth, int genderSequence) {
        String first12 = "%02d%02d%02d%04d08".formatted(
                dateOfBirth.getYear() % 100, dateOfBirth.getMonthValue(), dateOfBirth.getDayOfMonth(),
                genderSequence);
        int[] digits = first12.chars().map(c -> c - '0').toArray();
        int oddSum = digits[0] + digits[2] + digits[4] + digits[6] + digits[8] + digits[10];
        long evenNumber = 0;
        for (int i = 1; i <= 11; i += 2) {
            evenNumber = evenNumber * 10 + digits[i];
        }
        long doubled = evenNumber * 2;
        int evenSum = 0;
        while (doubled > 0) {
            evenSum += (int) (doubled % 10);
            doubled /= 10;
        }
        int checkDigit = (10 - ((oddSum + evenSum) % 10)) % 10;
        return first12 + checkDigit;
    }
}
