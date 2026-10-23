package co.ehealth.platform.appointment;

import co.ehealth.platform.core.audit.*;
import co.ehealth.platform.core.notification.EmailService;
import co.ehealth.platform.core.security.AuthenticatedPrincipal;
import co.ehealth.platform.core.tenant.OrganizationRepository;
import co.ehealth.platform.core.tenant.Organization;
import co.ehealth.platform.core.tenant.TenantContext;
import co.ehealth.platform.facility.*;
import co.ehealth.platform.identity.*;
import co.ehealth.platform.patient.*;
import org.flywaydb.core.Flyway;
import org.mockito.Mockito;
import org.hibernate.cfg.Configuration;
import org.hibernate.SessionFactory;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.data.jpa.repository.support.JpaRepositoryFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.orm.jpa.JpaTransactionManager;
import org.springframework.orm.jpa.SharedEntityManagerCreator;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.transaction.support.TransactionTemplate;
import java.time.*;
import java.util.*;
import java.util.concurrent.*;
import java.util.function.Supplier;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

/** Real migrations and concurrent service transactions, in a disposable schema only. */
@EnabledIfEnvironmentVariable(named = "APPOINTMENTS_TEST_JDBC_URL", matches = ".+")
class AppointmentPersistenceTest {
    private String schema;
    private JdbcTemplate jdbc;
    private SessionFactory factory;
    private TransactionTemplate tx;
    private AppointmentService service;
    private EmailService emails;
    private OrganizationRepository organizations;
    private final UUID facility = UUID.randomUUID(), secondFacility = UUID.randomUUID(), patient = UUID.randomUUID(), actor = UUID.randomUUID();
    private final LocalDate day = LocalDate.of(2027, 1, 10);

    @BeforeEach void setup() {
        schema = "appointment_test_" + UUID.randomUUID().toString().replace("-", "");
        String base = System.getenv("APPOINTMENTS_TEST_JDBC_URL");
        String url = base + (base.contains("?") ? "&" : "?") + "currentSchema=" + schema;
        var ds = new DriverManagerDataSource(url);
        jdbc = new JdbcTemplate(ds);
        Flyway.configure().dataSource(ds).schemas(schema).locations("classpath:db/migration/tenant").load().migrate();
        factory = new Configuration().addAnnotatedClass(Appointment.class).addAnnotatedClass(Facility.class)
                .addAnnotatedClass(Patient.class).addAnnotatedClass(Permission.class).addAnnotatedClass(AuditLog.class)
                .setProperty("hibernate.connection.url", url).setProperty("hibernate.hbm2ddl.auto", "validate")
                .buildSessionFactory();
        tx = new TransactionTemplate(new JpaTransactionManager(factory));
        var repos = new JpaRepositoryFactory(SharedEntityManagerCreator.createSharedEntityManager(factory));
        Clock clock = Clock.fixed(Instant.parse("2027-01-01T22:30:00Z"), ZoneOffset.UTC);
        // Exercise real appointment transactions without sending email or
        // accessing the shared control schema.
        emails = Mockito.mock(EmailService.class);
        organizations = Mockito.mock(OrganizationRepository.class);
        service = new AppointmentService(repos.getRepository(AppointmentRepository.class), repos.getRepository(FacilityRepository.class),
                repos.getRepository(PatientRepository.class), repos.getRepository(AppointmentStaffRepository.class), new PermissionService(repos.getRepository(PermissionRepository.class)),
                new AuditLogService(repos.getRepository(AuditLogRepository.class), clock), emails, organizations, clock);
        jdbc.update("INSERT INTO facilities(id,name,code,type,daily_appointment_limit) VALUES (?, 'Clinic A','A','CLINIC',1), (?, 'Clinic B','B','CLINIC',1)", facility, secondFacility);
        jdbc.update("INSERT INTO users(id,employee_number,email,first_name,last_name,contact_number,password_hash) VALUES (?, 'TEST','test@example.invalid','Test','Reception','0000000000','test')", actor);
        // Gives `actor` a real clinical role row — staffAssignmentIsFacilityScopedAndSurvivesReloadAndRescheduling
        // assigns appointments to `actor` as staff, which AppointmentStaffRepository.findAvailable()'s
        // clinical-role filter now requires a matching roles/user_roles row for
        // (designation is just a display string, not what the filter joins on).
        jdbc.update("INSERT INTO user_roles(user_id, role_id) SELECT ?, id FROM roles WHERE name = 'Doctor'", actor);
        jdbc.update("INSERT INTO patients(id,mpi_number,first_name,last_name,date_of_birth,gender,citizenship_status,id_number,address,contact_number) VALUES (?, 'MPI-TEST','Test','Patient','1990-01-01','FEMALE','SA_CITIZEN','9001010000000','Test','0000000000')", patient);
        authenticate("Admin Staff");
    }
    @AfterEach void cleanup() {
        SecurityContextHolder.clearContext();
        TenantContext.clear();
        if (factory != null) factory.close();
        if (jdbc != null && schema != null && schema.matches("appointment_test_[a-f0-9]{32}")) jdbc.execute("DROP SCHEMA " + schema + " CASCADE");
    }
    private void authenticate(String role) {
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(new AuthenticatedPrincipal(actor, "test"), null, List.of(new SimpleGrantedAuthority("ROLE_" + role))));
    }
    private <T> T run(Supplier<T> work) { return tx.execute(status -> work.get()); }
    private AppointmentService.Entry book(UUID facilityId, UUID id, LocalDate date) { return run(() -> service.book(facilityId, id, patient, date, LocalTime.of(9, 0), null, null, actor)); }

    @Test void lastPlaceIsAtomicAndRetriesDoNotDuplicate() throws Exception {
        var start = new CountDownLatch(1);
        try (var pool = Executors.newFixedThreadPool(2)) {
            List<Future<Object>> results = new ArrayList<>();
            for (int i = 0; i < 2; i++) results.add(pool.submit(() -> {
                authenticate("Admin Staff"); start.await();
                try { return book(facility, UUID.randomUUID(), day); }
                catch (AppointmentException ex) { return ex; }
                finally { SecurityContextHolder.clearContext(); }
            }));
            start.countDown();
            List<Object> values = new ArrayList<>();
            for (var result : results) values.add(result.get(20, TimeUnit.SECONDS));
            assertEquals(1, values.stream().filter(AppointmentService.Entry.class::isInstance).count());
            var conflict = (AppointmentException) values.stream().filter(AppointmentException.class::isInstance).findFirst().orElseThrow();
            assertEquals(409, conflict.status);
            var winner = (AppointmentService.Entry) values.stream().filter(AppointmentService.Entry.class::isInstance).findFirst().orElseThrow();
            assertEquals(winner.id(), book(facility, winner.id(), day).id());
            assertEquals(1, run(() -> service.diary(facility, day, 0)).booked());
            assertEquals(1, jdbc.queryForObject("SELECT count(*) FROM audit_log WHERE action='APPOINTMENT_BOOKED'", Integer.class));
        }
    }
    @Test void cancellationReschedulingAndLoweredLimitsPreserveCapacity() {
        var first = book(facility, UUID.randomUUID(), day);
        var tomorrow = book(facility, UUID.randomUUID(), day.plusDays(1));
        assertThrows(AppointmentException.class, () -> run(() -> service.reschedule(facility, first.id(), day.plusDays(1), LocalTime.NOON, null, null, first.version(), actor)));
        assertEquals(day, run(() -> service.diary(facility, day, 0)).items().getFirst().date());
        var moved = run(() -> service.reschedule(facility, first.id(), day, LocalTime.NOON, null, null, first.version(), actor));
        assertEquals(LocalTime.NOON, moved.time());
        assertThrows(AppointmentException.class, () -> run(() -> service.cancel(facility, first.id(), "Stale", first.version(), actor)));
        run(() -> service.cancel(facility, first.id(), "Patient requested cancellation", moved.version(), actor));
        run(() -> service.cancel(facility, first.id(), "Retry", moved.version(), actor));
        assertEquals(0, run(() -> service.diary(facility, day, 0)).booked());
        book(facility, UUID.randomUUID(), day);
        authenticate("ORG_ADMIN");
        run(() -> service.updateLimit(facility, null, actor));
        book(facility, UUID.randomUUID(), day);
        run(() -> service.updateLimit(facility, 1, actor));
        assertEquals(2, run(() -> service.diary(facility, day, 0)).booked());
        assertThrows(AppointmentException.class, () -> book(facility, UUID.randomUUID(), day));
        assertEquals("CONFIRMED", run(() -> service.diary(facility, day.plusDays(1), 0)).items().getFirst().status());
        assertNotNull(tomorrow.id());
    }
    @Test void scopesPermissionsAndFacilityLocalDatesAreEnforced() {
        assertEquals(LocalDate.of(2027, 1, 2), run(() -> service.diary(facility, null, 0)).date());
        var a = book(facility, UUID.randomUUID(), day);
        book(secondFacility, UUID.randomUUID(), day);
        assertEquals(1, run(() -> service.diary(facility, day, 0)).booked());
        assertThrows(AppointmentException.class, () -> run(() -> service.cancel(secondFacility, a.id(), "Wrong facility", 0, actor)));
        assertThrows(NotAClinicalRoleException.class, () -> run(() -> service.updateLimit(facility, 100, actor)));
        authenticate("Doctor");
        assertFalse(run(() -> service.diary(facility, day, 0)).canManage());
        assertThrows(NotAuthorizedException.class, () -> book(facility, UUID.randomUUID(), day.plusDays(2)));
        SecurityContextHolder.clearContext();
        assertThrows(NotAuthorizedException.class, () -> run(() -> service.diary(facility, day, 0)));
        authenticate("ORG_ADMIN");
        assertThrows(AppointmentException.class, () -> run(() -> service.updateLimit(facility, 0, actor)));
        assertThrows(AppointmentException.class, () -> book(facility, UUID.randomUUID(), LocalDate.of(2026, 1, 1)));
    }
    @Test void staffAssignmentIsFacilityScopedAndSurvivesReloadAndRescheduling() {
        UUID additional = UUID.randomUUID(), otherFacilityStaff = UUID.randomUUID();
        jdbc.update("UPDATE users SET facility_id=?, designation='Doctor' WHERE id=?", facility, actor);
        jdbc.update("INSERT INTO users(id,employee_number,email,first_name,last_name,contact_number,password_hash,facility_id) VALUES (?, 'ADDITIONAL','additional@example.invalid','Additional','Nurse','0000000001','test',?), (?, 'OTHER','other@example.invalid','Other','Doctor','0000000002','test',?)", additional, secondFacility, otherFacilityStaff, secondFacility);
        jdbc.update("INSERT INTO user_facilities(user_id,facility_id) VALUES (?,?)", additional, facility);
        jdbc.update("INSERT INTO user_roles(user_id, role_id) SELECT ?, id FROM roles WHERE name = 'Professional Nurse'", additional);
        jdbc.update("INSERT INTO user_roles(user_id, role_id) SELECT ?, id FROM roles WHERE name = 'Doctor'", otherFacilityStaff);
        assertEquals(2, run(() -> service.availableStaff(facility)).size());
        assertThrows(AppointmentException.class, () -> run(() -> service.book(facility, UUID.randomUUID(), patient, day, LocalTime.NOON, otherFacilityStaff, null, actor)));
        assertThrows(AppointmentException.class, () -> run(() -> service.book(facility, UUID.randomUUID(), patient, day, LocalTime.NOON, UUID.randomUUID(), null, actor)));
        UUID requestId = UUID.randomUUID();
        var booked = run(() -> service.book(facility, requestId, patient, day, LocalTime.NOON, actor, null, actor));
        assertEquals(actor, booked.assignedStaffId());
        assertEquals("Test Reception", booked.assignedStaffName());
        var loaded = run(() -> service.diary(facility, day, 0)).items().getFirst();
        assertEquals(actor, loaded.assignedStaffId());
        assertEquals("Test Reception", loaded.assignedStaffName());
        assertEquals(booked.id(), run(() -> service.book(facility, requestId, patient, day, LocalTime.NOON, actor, null, actor)).id());
        assertThrows(AppointmentException.class, () -> run(() -> service.book(facility, requestId, patient, day, LocalTime.NOON, additional, null, actor)));
        var changed = run(() -> service.reschedule(facility, booked.id(), day, LocalTime.NOON, additional, null, booked.version(), actor));
        assertEquals(additional, changed.assignedStaffId());
        assertEquals("Additional Nurse", changed.assignedStaffName());
        assertEquals(1, run(() -> service.diary(facility, day, 0)).booked());
        jdbc.update("UPDATE users SET status='DISABLED' WHERE id=?", additional);
        assertEquals(1, run(() -> service.availableStaff(facility)).size());
        assertEquals("Additional Nurse", run(() -> service.diary(facility, day, 0)).items().getFirst().assignedStaffName());
        assertThrows(AppointmentException.class, () -> run(() -> service.book(facility, UUID.randomUUID(), patient, day.plusDays(1), LocalTime.NOON, additional, null, actor)));
        var unassigned = run(() -> service.reschedule(facility, booked.id(), day, LocalTime.NOON, null, null, changed.version(), actor));
        assertNull(unassigned.assignedStaffId());
        assertNull(unassigned.assignedStaffName());
    }

    @Test void staffDoubleBookingWithinMinimumGapIsRejectedButFartherApartOrOtherStaffIsFine() {
        UUID nurse = UUID.randomUUID();
        authenticate("ORG_ADMIN");
        run(() -> service.updateLimit(facility, null, actor)); // fixture default is 1/day; this test books several
        jdbc.update("UPDATE users SET facility_id=? WHERE id=?", facility, actor);
        jdbc.update("INSERT INTO users(id,employee_number,email,first_name,last_name,contact_number,password_hash,facility_id) VALUES (?, 'NURSE','nurse@example.invalid','Test','Nurse','0000000003','test',?)", nurse, facility);
        jdbc.update("INSERT INTO user_roles(user_id, role_id) SELECT ?, id FROM roles WHERE name = 'Professional Nurse'", nurse);

        var first = run(() -> service.book(facility, UUID.randomUUID(), patient, day, LocalTime.of(9, 0), actor, null, actor));

        // 15 minutes away — inside the 30-minute minimum gap.
        assertThrows(AppointmentException.class,
                () -> run(() -> service.book(facility, UUID.randomUUID(), patient, day, LocalTime.of(9, 15), actor, null, actor)));
        // Same collision the other direction (new appointment before the existing one).
        assertThrows(AppointmentException.class,
                () -> run(() -> service.book(facility, UUID.randomUUID(), patient, day, LocalTime.of(8, 45), actor, null, actor)));

        // Exactly 30 minutes away — the boundary is allowed, not rejected.
        var second = run(() -> service.book(facility, UUID.randomUUID(), patient, day, LocalTime.of(9, 30), actor, null, actor));
        assertEquals(LocalTime.of(9, 30), second.time());

        // A different clinician at the exact same colliding time has nothing to collide with.
        var thirdWithNurse = run(() -> service.book(facility, UUID.randomUUID(), patient, day, LocalTime.of(9, 15), nurse, null, actor));
        assertEquals(nurse, thirdWithNurse.assignedStaffId());

        // Rescheduling into another of the same clinician's slots is rejected too...
        assertThrows(AppointmentException.class,
                () -> run(() -> service.reschedule(facility, second.id(), day, LocalTime.of(9, 5), actor, null, second.version(), actor)));
        // ...but rescheduling a booking to its own existing date/time/staff is not a
        // self-collision (excludeAppointmentId), even though changing the notes here
        // means the early-return short-circuit above doesn't skip the check entirely.
        var reloaded = run(() -> service.reschedule(facility, second.id(), day, LocalTime.of(9, 30), actor, "same slot", second.version(), actor));
        assertEquals("same slot", reloaded.notes());

        // Cancelling frees the slot for the same clinician.
        run(() -> service.cancel(facility, first.id(), "No longer needed", first.version(), actor));
        var afterCancel = run(() -> service.book(facility, UUID.randomUUID(), patient, day, LocalTime.of(9, 0), actor, null, actor));
        assertEquals(LocalTime.of(9, 0), afterCancel.time());
    }

    @Test void diaryCanBeFilteredByAssignedStaffUnassignedOnlyAndStatus() {
        UUID nurse = UUID.randomUUID();
        authenticate("ORG_ADMIN");
        run(() -> service.updateLimit(facility, null, actor)); // fixture default is 1/day; this test books several
        jdbc.update("UPDATE users SET facility_id=? WHERE id=?", facility, actor);
        jdbc.update("INSERT INTO users(id,employee_number,email,first_name,last_name,contact_number,password_hash,facility_id) VALUES (?, 'NURSE','nurse@example.invalid','Test','Nurse','0000000003','test',?)", nurse, facility);
        jdbc.update("INSERT INTO user_roles(user_id, role_id) SELECT ?, id FROM roles WHERE name = 'Professional Nurse'", nurse);

        var withDoctor = run(() -> service.book(facility, UUID.randomUUID(), patient, day, LocalTime.of(9, 0), actor, null, actor));
        var withNurse = run(() -> service.book(facility, UUID.randomUUID(), patient, day, LocalTime.of(10, 0), nurse, null, actor));
        var unassignedAppt = run(() -> service.book(facility, UUID.randomUUID(), patient, day, LocalTime.of(11, 0), null, null, actor));
        run(() -> service.cancel(facility, withNurse.id(), "Patient cancelled", withNurse.version(), actor));

        // No filters — the diary itself always shows cancelled appointments
        // too (only the daily-limit count excludes them), so all three show.
        assertEquals(3, run(() -> service.diary(facility, day, 0)).totalItems());

        // Filtered to the doctor only — the nurse's (cancelled) and the unassigned one drop out.
        var byDoctor = run(() -> service.diary(facility, day, 0, actor, false, null));
        assertEquals(1, byDoctor.totalItems());
        assertEquals(withDoctor.id(), byDoctor.items().getFirst().id());

        // Filtered to unassigned only.
        var unassignedOnly = run(() -> service.diary(facility, day, 0, null, true, null));
        assertEquals(1, unassignedOnly.totalItems());
        assertEquals(unassignedAppt.id(), unassignedOnly.items().getFirst().id());

        // Filtered by status=CANCELLED — only the nurse's cancelled appointment.
        var cancelledOnly = run(() -> service.diary(facility, day, 0, null, false, "CANCELLED"));
        assertEquals(1, cancelledOnly.totalItems());
        assertEquals(withNurse.id(), cancelledOnly.items().getFirst().id());

        // Filters combine — the doctor's own CONFIRMED appointment, status=CONFIRMED.
        var doctorConfirmed = run(() -> service.diary(facility, day, 0, actor, false, "CONFIRMED"));
        assertEquals(1, doctorConfirmed.totalItems());

        // booked/remaining stay based on real (non-cancelled) capacity, unaffected by these display filters.
        assertEquals(2, byDoctor.booked());
        assertEquals(2, unassignedOnly.booked());
    }

    @Test void notesPersistNormalizeAndParticipateInBookingIdempotency() {
        UUID request = UUID.randomUUID();
        var entry = run(() -> service.book(facility, request, patient, day, LocalTime.NOON, null, "  Bring previous referral  ", actor));
        assertEquals("Bring previous referral", entry.notes());
        assertEquals(entry.notes(), run(() -> service.diary(facility, day, 0)).items().getFirst().notes());
        assertEquals(entry.id(), run(() -> service.book(facility, request, patient, day, LocalTime.NOON, null, "Bring previous referral", actor)).id());
        assertEquals(409, assertThrows(AppointmentException.class,
                () -> run(() -> service.book(facility, request, patient, day, LocalTime.NOON, null, "Different notes", actor))).status);
        assertEquals(400, assertThrows(AppointmentException.class,
                () -> run(() -> service.reschedule(facility, request, day, LocalTime.NOON, null, "x".repeat(1001), entry.version(), actor))).status);
        var cleared = run(() -> service.reschedule(facility, request, day, LocalTime.NOON, null, "  \n  ", entry.version(), actor));
        assertNull(cleared.notes());
        assertNull(run(() -> service.diary(facility, day, 0)).items().getFirst().notes());
        verifyNoInteractions(emails);
    }

    @Test void patientEmailIsDispatchedAfterCommitOnceWithFacilityLocalTime() {
        preparePatientEmail();
        jdbc.update("UPDATE users SET facility_id=?, designation='Doctor' WHERE id=?", facility, actor);
        UUID request = UUID.randomUUID();
        var entry = run(() -> {
            var result = service.book(facility, request, patient, day, LocalTime.of(0, 15), actor, "Private care-team note", actor);
            verifyNoInteractions(emails);
            return result;
        });
        verify(emails).sendAppointmentConfirmedEmail("patient@example.invalid", "Test", "Test Organization",
                "Clinic A", "Sunday, 10 January 2027", "00:15 (Africa/Johannesburg, UTC+02:00)", "Test Reception");
        run(() -> service.book(facility, request, patient, day, LocalTime.of(0, 15), actor, "Private care-team note", actor));
        verifyNoMoreInteractions(emails);

        var notesOnly = run(() -> service.reschedule(facility, request, day, LocalTime.of(0, 15), actor,
                "Another internal note", entry.version(), actor));
        verifyNoMoreInteractions(emails);
        var moved = run(() -> {
            var result = service.reschedule(facility, request, day.plusDays(1), LocalTime.of(8, 30), actor,
                    "Another internal note", notesOnly.version(), actor);
            verifyNoMoreInteractions(emails);
            return result;
        });
        verify(emails).sendAppointmentUpdatedEmail("patient@example.invalid", "Test", "Test Organization",
                "Clinic A", "Monday, 11 January 2027", "08:30 (Africa/Johannesburg, UTC+02:00)", "Test Reception");
        run(() -> service.reschedule(facility, request, day.plusDays(1), LocalTime.of(8, 30), actor,
                "Another internal note", notesOnly.version(), actor));
        verifyNoMoreInteractions(emails);
        assertEquals(day.plusDays(1), moved.date());
        jdbc.update("UPDATE facilities SET timezone='UTC' WHERE id=?", facility);
        run(() -> service.reschedule(facility, request, day.plusDays(2), LocalTime.of(0, 15), actor,
                "Another internal note", moved.version(), actor));
        verify(emails).sendAppointmentUpdatedEmail("patient@example.invalid", "Test", "Test Organization",
                "Clinic A", "Tuesday, 12 January 2027", "00:15 (UTC, UTC+00:00)", "Test Reception");
    }

    @Test void rollbackSkipsEmailAndDispatchFailureDoesNotUndoBooking() {
        preparePatientEmail();
        UUID rolledBack = UUID.randomUUID();
        assertThrows(IllegalStateException.class, () -> run(() -> {
            service.book(facility, rolledBack, patient, day, LocalTime.NOON, null, null, actor);
            throw new IllegalStateException("Simulate a later transaction failure");
        }));
        verifyNoInteractions(emails);
        assertEquals(0, run(() -> service.diary(facility, day, 0)).totalItems());
        doThrow(new IllegalStateException("Simulated mail dispatch failure")).when(emails)
                .sendAppointmentConfirmedEmail(anyString(), anyString(), anyString(), anyString(), anyString(), anyString(), isNull());
        var entry = book(facility, UUID.randomUUID(), day);
        assertEquals(entry.id(), run(() -> service.diary(facility, day, 0)).items().getFirst().id());
        verify(emails).sendAppointmentConfirmedEmail("patient@example.invalid", "Test", "Test Organization",
                "Clinic A", "Sunday, 10 January 2027", "09:00 (Africa/Johannesburg, UTC+02:00)", null);
    }

    @Test void clinicianOptionsExcludeNonClinicalStaffAndUseRolesWhenDesignationIsMissing() {
        UUID receptionist = UUID.randomUUID();
        jdbc.update("UPDATE users SET facility_id=?, designation=NULL WHERE id=?", facility, actor);
        jdbc.update("INSERT INTO user_roles(user_id, role_id) SELECT ?, id FROM roles WHERE name = 'Professional Nurse'", actor);
        jdbc.update("INSERT INTO users(id,employee_number,email,first_name,last_name,contact_number,password_hash,facility_id) VALUES (?, 'RECEPTION','reception@example.invalid','Admin','Reception','0000000004','test',?)", receptionist, facility);
        jdbc.update("INSERT INTO user_roles(user_id, role_id) SELECT ?, id FROM roles WHERE name = 'Admin Staff'", receptionist);
        var clinicians = run(() -> service.availableStaff(facility));
        assertEquals(1, clinicians.size());
        assertEquals(actor, clinicians.getFirst().getId());
        assertEquals("Doctor, Professional Nurse", clinicians.getFirst().getDesignation());
        assertThrows(AppointmentException.class, () -> run(() -> service.book(facility, UUID.randomUUID(), patient,
                day, LocalTime.NOON, receptionist, null, actor)));
    }

    private void preparePatientEmail() {
        TenantContext.setCurrentTenant(schema);
        jdbc.update("UPDATE patients SET email='patient@example.invalid' WHERE id=?", patient);
        Organization organization = mock(Organization.class);
        when(organization.getDisplayName()).thenReturn("Test Organization");
        when(organizations.findBySchemaName(schema)).thenReturn(Optional.of(organization));
    }

}
