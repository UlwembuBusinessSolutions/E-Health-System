package co.ehealth.platform.pharmacy.stock;

import co.ehealth.platform.core.audit.*;
import co.ehealth.platform.core.notification.EmailService;
import co.ehealth.platform.core.tenant.OrganizationRepository;
import co.ehealth.platform.facility.*;
import co.ehealth.platform.identity.*;
import co.ehealth.platform.pharmacy.*;
import co.ehealth.platform.visit.VisitService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.flywaydb.core.Flyway;
import org.hibernate.SessionFactory;
import org.hibernate.cfg.Configuration;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.data.jpa.repository.support.JpaRepositoryFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.orm.jpa.*;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.server.ResponseStatusException;
import java.time.*;
import java.util.*;
import java.util.concurrent.*;
import java.util.function.Supplier;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

/** Runs real tenant migrations and concurrent transactions in a disposable schema. */
@EnabledIfEnvironmentVariable(named = "STOCK_TEST_JDBC_URL", matches = ".+")
class StockControlPersistenceTest {
    String schema;
    JdbcTemplate jdbc;
    SessionFactory factory;
    TransactionTemplate tx;
    PharmacyStockControlService control;
    PharmacyReceiptService receipts;
    PharmacyStockQueryService query;
    PrescriptionService prescriptions;
    PharmacyDutyService duty;
    PrescriberDispensingReportService report;
    StaffService staff;
    UserRepository users;
    final UUID clinic = UUID.randomUUID(), otherClinic = UUID.randomUUID(), product = UUID.randomUUID(), actor = UUID.randomUUID();
    final Clock clock = Clock.fixed(Instant.parse("2026-09-29T10:00:00Z"), ZoneOffset.UTC);

    @BeforeEach void setup() {
        schema = "stock_test_" + UUID.randomUUID().toString().replace("-", "");
        String base = System.getenv("STOCK_TEST_JDBC_URL");
        String url = base + (base.contains("?") ? "&" : "?") + "currentSchema=" + schema;
        var ds = new DriverManagerDataSource(url);
        ds.setUsername(System.getenv("STOCK_TEST_DB_USER"));
        ds.setPassword(System.getenv("STOCK_TEST_DB_PASSWORD"));
        jdbc = new JdbcTemplate(ds);
        Flyway.configure().dataSource(ds).schemas(schema).locations("classpath:db/migration/tenant").load().migrate();
        var config = new Configuration().setProperty("hibernate.connection.url", url)
                .setProperty("hibernate.hbm2ddl.auto", "validate");
        if (System.getenv("STOCK_TEST_DB_USER") != null) config.setProperty("hibernate.connection.username", System.getenv("STOCK_TEST_DB_USER"));
        if (System.getenv("STOCK_TEST_DB_PASSWORD") != null) config.setProperty("hibernate.connection.password", System.getenv("STOCK_TEST_DB_PASSWORD"));
        for (var entity : List.of(Facility.class, PharmacyProduct.class, PharmacyFacilityProduct.class,
                PharmacyStockLocation.class, PharmacyBatch.class, PharmacyStockAccount.class,
                PharmacyStockTransaction.class, PharmacyStockEntry.class, PharmacyReceipt.class,
                PharmacyReceiptLine.class, AuditLog.class, Prescription.class, PrescriptionItem.class, DispensingRecord.class,
                PharmacyDutyEntry.class, User.class, co.ehealth.platform.patient.Patient.class))
            config.addAnnotatedClass(entity);
        factory = config.buildSessionFactory();
        tx = new TransactionTemplate(new JpaTransactionManager(factory));
        var repos = new JpaRepositoryFactory(SharedEntityManagerCreator.createSharedEntityManager(factory));
        var facilities = repos.getRepository(FacilityRepository.class);
        var products = repos.getRepository(PharmacyProductRepository.class);
        var assortment = repos.getRepository(PharmacyFacilityProductRepository.class);
        var accounts = repos.getRepository(PharmacyStockAccountRepository.class);
        var batches = repos.getRepository(PharmacyBatchRepository.class);
        var entries = repos.getRepository(PharmacyStockEntryRepository.class);
        var transactions = repos.getRepository(PharmacyStockTransactionRepository.class);
        var audit = new AuditLogService(repos.getRepository(AuditLogRepository.class), clock);
        var ledger = new PharmacyStockLedgerService(accounts, transactions, entries, clock, facilities);
        var mapper = new ObjectMapper().findAndRegisterModules();
        control = new PharmacyStockControlService(facilities, accounts, batches, products, assortment,
                transactions, ledger, audit, mapper, clock);
        query = new PharmacyStockQueryService(accounts, products, batches, entries, transactions, assortment);
        receipts = new PharmacyReceiptService(products, assortment, batches, repos.getRepository(PharmacyReceiptRepository.class),
                repos.getRepository(PharmacyReceiptLineRepository.class), ledger,
                new PharmacyStockLocationService(repos.getRepository(PharmacyStockLocationRepository.class), clock),
                facilities, audit, mapper, clock);
        staff = mock(StaffService.class);
        when(staff.getLicenseStatus(actor)).thenReturn(new StaffService.LicenseStatus(false, true));
        users = mock(UserRepository.class);
        var user = mock(User.class);
        when(user.getFirstName()).thenReturn("Test"); when(user.getLastName()).thenReturn("Pharmacist");
        when(users.findById(actor)).thenReturn(Optional.of(user));
        duty = new PharmacyDutyService(repos.getRepository(PharmacyDutyRepository.class), facilities, staff, users,
                mock(PermissionService.class), audit, clock);
        report = new PrescriberDispensingReportService(SharedEntityManagerCreator.createSharedEntityManager(factory),
                mock(PermissionService.class), audit);
        prescriptions = new PrescriptionService(repos.getRepository(PrescriptionRepository.class),
                repos.getRepository(PrescriptionItemRepository.class), repos.getRepository(DispensingRecordRepository.class),
                mock(PrescriptionOutOfStockRecordRepository.class), mock(PrescriberMessageRepository.class), mock(VisitService.class),
                staff, users, mock(OrganizationRepository.class), mock(EmailService.class), audit, clock,
                mock(PermissionService.class), control, duty);
        jdbc.update("INSERT INTO facilities(id,name,code,type) VALUES (?,'A','A','CLINIC'), (?,'B','B','CLINIC')", clinic, otherClinic);
        jdbc.update("INSERT INTO users(id,employee_number,email,first_name,last_name,contact_number,password_hash) VALUES (?,'STOCK-TEST','stock@example.invalid','Test','Staff','000','test')", actor);
        jdbc.update("INSERT INTO pharmacy_products(id,code,display_name,category,base_unit,batch_tracked,expiry_tracked,created_by,created_by_name,created_at) VALUES (?,'MED','Test medicine','MEDICINE','TABLET',true,true,?,'Test',now())", product, actor);
        jdbc.update("INSERT INTO pharmacy_facility_products(product_id,facility_id,reorder_threshold,created_at) VALUES (?,?,5,now()), (?,?,5,now())", product, clinic, product, otherClinic);
    }

    @AfterEach void cleanup() {
        if (factory != null) factory.close();
        if (jdbc != null && schema != null && schema.matches("stock_test_[a-f0-9]{32}")) jdbc.execute("DROP SCHEMA " + schema + " CASCADE");
    }
    <T> T run(Supplier<T> call) { return tx.execute(s -> call.get()); }
    void receive(int quantity, String lot, LocalDate expiry) {
        run(() -> receipts.receive(new PharmacyReceiptService.ReceiveStockCommand(clinic, "DELIVERY", null,
                List.of(new PharmacyReceiptService.ReceiveLineCommand(product, "Maker", lot, expiry, ExpiryPrecision.DAY,
                        null, null, quantity))), UUID.randomUUID().toString(), actor, "Test"));
    }
    long balance() { return run(() -> query.listFacilityBalances(clinic).getFirst().available()); }
    UUID account() { return jdbc.queryForObject("SELECT id FROM pharmacy_stock_accounts LIMIT 1", UUID.class); }
    PharmacyStockControlService.CountCommand count(long expected, long actual) {
        return new PharmacyStockControlService.CountCommand(clinic, product, account(), expected, actual, "Cycle count C-1");
    }
    long rows(String table) { return jdbc.queryForObject("SELECT count(*) FROM " + table, Long.class); }

    @Test void zeroBalancesAndReorderAlertsAreClinicScopedAndClearAfterReceipt() {
        assertEquals(0, balance());
        receive(10, "LOT", LocalDate.of(2027, 1, 1));
        assertEquals(10, balance());
        assertEquals(0, run(() -> query.listFacilityBalances(otherClinic).getFirst().available()));
        run(() -> control.count(count(10, 0), UUID.randomUUID(), actor, "Counter"));
        var alert = run(() -> query.listFacilityBalances(clinic).getFirst());
        assertTrue(alert.available() <= alert.reorderThreshold());
        receive(9, "LOT", LocalDate.of(2027, 1, 1));
        assertTrue(balance() > alert.reorderThreshold());
        assertEquals(3, rows("pharmacy_stock_entries"));
    }

    @Test void countsAreAuditedIdempotentAndRejectStaleSnapshotsOrWrongClinic() {
        receive(10, "LOT", LocalDate.of(2027, 1, 1));
        var command = count(10, 7);
        UUID key = UUID.randomUUID();
        var first = run(() -> control.count(command, key, actor, "Counter"));
        assertEquals(first.getId(), run(() -> control.count(command, key, actor, "Counter")).getId());
        assertEquals(7, balance());
        assertEquals(2, rows("pharmacy_stock_entries"));
        assertEquals(1, jdbc.queryForObject("SELECT count(*) FROM audit_log WHERE action='STOCK_COUNT_POSTED'", Long.class));
        assertThrows(IdempotencyConflictException.class, () -> run(() -> control.count(count(7, 6), key, actor, "Counter")));
        assertThrows(ResponseStatusException.class, () -> run(() -> control.count(command, UUID.randomUUID(), actor, "Counter")));
        var wrongClinic = new PharmacyStockControlService.CountCommand(otherClinic, product, account(), 7, 0, "Wrong clinic");
        assertThrows(ResponseStatusException.class, () -> run(() -> control.count(wrongClinic, UUID.randomUUID(), actor, "Counter")));
        run(() -> control.count(count(7, 7), UUID.randomUUID(), actor, "Counter"));
        assertEquals(3, rows("pharmacy_stock_entries"));
        assertEquals(7, balance());
    }

    @Test void concurrentCountsCannotOverwriteEachOther() throws Exception {
        receive(10, "LOT", LocalDate.of(2027, 1, 1));
        var command = count(10, 8);
        try (var pool = Executors.newFixedThreadPool(2)) {
            var start = new CountDownLatch(1);
            Callable<Boolean> work = () -> { start.await(); try {
                run(() -> control.count(command, UUID.randomUUID(), actor, "Counter")); return true;
            } catch (ResponseStatusException e) { return false; } };
            var one = pool.submit(work); var two = pool.submit(work); start.countDown();
            assertNotEquals(one.get(15, TimeUnit.SECONDS), two.get(15, TimeUnit.SECONDS));
        }
        assertEquals(8, balance());
        assertEquals(2, rows("pharmacy_stock_entries"));
    }

    record Rx(UUID id, List<UUID> items) {}
    Rx prescription(int... quantities) {
        UUID patient = UUID.randomUUID(), visit = UUID.randomUUID(), rx = UUID.randomUUID();
        jdbc.update("INSERT INTO patients(id,mpi_number,first_name,last_name,date_of_birth,gender,citizenship_status,id_number,address,contact_number) VALUES (?,?,'Test','Patient','1990-01-01','FEMALE','SA_CITIZEN',?,'Test','000')", patient, patient.toString().substring(0,20), patient.toString().substring(0,13));
        jdbc.update("INSERT INTO visits(id,patient_id,facility_id,visit_type,service_stream,visit_datetime) VALUES (?,?,?,'NEW','GENERAL',now())", visit, patient, clinic);
        jdbc.update("INSERT INTO prescriptions(id,serial_number,visit_id,patient_id,facility_id,prescriber_id) VALUES (?,?,?,?,?,?)", rx, rx.toString().substring(0,20), visit, patient, clinic, actor);
        var items = new ArrayList<UUID>();
        for (int q : quantities) { UUID id = UUID.randomUUID(); items.add(id); jdbc.update("INSERT INTO prescription_items(id,prescription_id,drug_name,dosage,quantity,status) VALUES (?,?,'Test','Daily',?,'PENDING')", id, rx, q); }
        return new Rx(rx, items);
    }

    @Test void bulkDispensingRollsBackStockStatusAndAuditWhenAnyItemCannotBeFilled() {
        receive(10, "LOT", LocalDate.of(2027, 1, 1));
        var rx = prescription(6, 6);
        assertThrows(InsufficientStockException.class, () -> run(() -> {
            prescriptions.dispenseAllPending(rx.id(), actor, Map.of(rx.items().get(0), product, rx.items().get(1), product)); return null;
        }));
        assertEquals(10, balance()); assertEquals(0, rows("dispensing_records")); assertEquals(1, rows("pharmacy_stock_entries"));
        assertEquals(0, jdbc.queryForObject("SELECT count(*) FROM prescription_items WHERE status='DISPENSED'", Long.class));
        assertEquals(0, jdbc.queryForObject("SELECT count(*) FROM audit_log WHERE action='PRESCRIPTION_ITEM_DISPENSED'", Long.class));
    }

    @Test void concurrentDispensePostsOnceAndCannotOversell() throws Exception {
        receive(10, "LOT", LocalDate.of(2027, 1, 1));
        var rx = prescription(8);
        try (var pool = Executors.newFixedThreadPool(2)) {
            var start = new CountDownLatch(1);
            Callable<Boolean> work = () -> { start.await(); try {
                run(() -> { prescriptions.dispenseItem(rx.id(), rx.items().getFirst(), actor, product); return null; }); return true;
            } catch (PrescriptionAlreadyDispensedException e) { return false; } };
            var one = pool.submit(work); var two = pool.submit(work); start.countDown();
            assertNotEquals(one.get(15, TimeUnit.SECONDS), two.get(15, TimeUnit.SECONDS));
        }
        assertEquals(2, balance()); assertEquals(1, rows("dispensing_records")); assertEquals(2, rows("pharmacy_stock_entries"));
        var second = prescription(3);
        assertThrows(InsufficientStockException.class, () -> run(() -> { prescriptions.dispenseItem(second.id(), second.items().getFirst(), actor, product); return null; }));
        assertEquals(2, balance());
    }

    @Test void dispensingSkipsExpiredLotsAndSplitsByEarliestExpiry() {
        receive(50, "EXPIRED", LocalDate.of(2026, 1, 1));
        receive(3, "EARLY", LocalDate.of(2026, 10, 1));
        receive(9, "LATE", LocalDate.of(2027, 1, 1));
        var rx = prescription(5);
        run(() -> { prescriptions.dispenseItem(rx.id(), rx.items().getFirst(), actor, product); return null; });
        assertEquals(57, balance());
        assertEquals(List.of(-3L, -2L), jdbc.queryForList("SELECT e.quantity_delta FROM pharmacy_stock_entries e JOIN pharmacy_stock_accounts a ON a.id=e.stock_account_id JOIN pharmacy_batches b ON b.id=a.batch_id WHERE quantity_delta < 0 ORDER BY b.expiry_date", Long.class));
    }

    @Test void prescriberDispensingStoresReportingFlagsAndAuditWithStockAtomically() {
        receive(10, "LOT", LocalDate.of(2027, 1, 1));
        when(staff.getLicenseStatus(actor)).thenReturn(new StaffService.LicenseStatus(true, false));
        when(users.findRoleNames(actor)).thenReturn(List.of("Medical Officer"));
        var rx = prescription(2, 3);
        var selections = Map.of(rx.items().get(0), product, rx.items().get(1), product);
        assertThrows(InvalidPrescriberDispenseException.class, () -> run(() -> {
            prescriptions.dispenseAllPending(rx.id(), actor, selections, true, false); return null;
        }));
        assertEquals(10, balance()); assertEquals(0, rows("dispensing_records"));
        run(() -> duty.record(clinic, actor, "NO_DISPENSER", 1, "No dispenser scheduled at this clinic"));
        run(() -> { prescriptions.dispenseAllPending(rx.id(), actor, selections, true, true); return null; });
        assertEquals(5, balance());
        assertEquals(2, jdbc.queryForObject("SELECT count(*) FROM dispensing_records WHERE prescriber_dispensed AND no_dispenser_on_duty", Long.class));
        assertEquals(2, jdbc.queryForObject("SELECT count(*) FROM audit_log WHERE action='PRESCRIPTION_ITEM_PRESCRIBER_DISPENSED'", Long.class));
        assertEquals(2, jdbc.queryForObject("SELECT count(*) FROM prescription_items WHERE status='DISPENSED'", Long.class));
        assertEquals(2, jdbc.queryForObject("SELECT count(*) FROM dispensing_records WHERE duty_entry_id IS NOT NULL", Long.class));
        var day=clock.instant().atOffset(ZoneOffset.UTC).toLocalDate();
        var result=run(() -> report.report(clinic,day,day,0,25));
        assertEquals(2, result.totalItems());
        var firstPage=run(() -> report.report(clinic,day,day,0,1));
        var secondPage=run(() -> report.report(clinic,day,day,1,1));
        assertEquals(1,firstPage.items().size());
        assertNotEquals(firstPage.items().getFirst().id(),secondPage.items().getFirst().id());
        assertEquals("No dispenser scheduled at this clinic",result.items().getFirst().dutyReason());
        assertEquals(0,run(() -> report.report(otherClinic,day,day,0,25)).totalItems());
        assertEquals(0,run(() -> report.report(clinic,day.plusDays(1),day.plusDays(1),0,25)).totalItems());
        String csv=run(() -> report.export(clinic,day,day,actor));
        assertTrue(csv.contains("Prescriber dispensed"));
        assertEquals(1,jdbc.queryForObject("SELECT count(*) FROM audit_log WHERE action='PRESCRIBER_DISPENSING_REPORT_EXPORTED'",Long.class));
    }

    @Test void dutyRegisterBlocksUnknownActiveExpiredAndWrongClinicAvailability() {
        receive(10, "LOT", LocalDate.of(2027, 1, 1));
        var rx=prescription(2);
        when(staff.getLicenseStatus(actor)).thenReturn(new StaffService.LicenseStatus(true,true));
        when(users.findRoleNames(actor)).thenReturn(List.of("Medical Officer"));
        assertThrows(ResponseStatusException.class, () -> run(() -> {
            prescriptions.dispenseItem(rx.id(),rx.items().getFirst(),actor,product,true,true); return null;
        }));
        run(() -> duty.record(otherClinic,actor,"NO_DISPENSER",1,"Other clinic"));
        assertThrows(ResponseStatusException.class, () -> run(() -> duty.requireAbsence(clinic)));
        var absence=run(() -> duty.record(clinic,actor,"NO_DISPENSER",1,"No dispenser present"));
        assertEquals(absence,run(() -> duty.requireAbsence(clinic)));
        var shift=run(() -> duty.record(clinic,actor,"ON_DUTY",8,"Morning shift"));
        assertEquals("ON_DUTY",run(() -> duty.status(clinic,actor)).status());
        assertThrows(ResponseStatusException.class, () -> run(() -> duty.record(clinic,actor,"NO_DISPENSER",1,"Invalid absence")));
        assertThrows(ResponseStatusException.class, () -> run(() -> {
            prescriptions.dispenseItem(rx.id(),rx.items().getFirst(),actor,product,true,true); return null;
        }));
        assertThrows(ResponseStatusException.class, () -> run(() -> { duty.end(clinic,shift,UUID.randomUUID()); return null; }));
        run(() -> { duty.end(clinic,shift,actor); return null; });
        assertEquals("UNKNOWN",run(() -> duty.status(clinic,actor)).status());
        var refreshed=run(() -> duty.record(clinic,actor,"NO_DISPENSER",1,"Shift has ended"));
        jdbc.update("UPDATE pharmacy_duty_entries SET started_at=?, expires_at=? WHERE id=?",
            java.sql.Timestamp.from(clock.instant().minusSeconds(7200)),java.sql.Timestamp.from(clock.instant().minusSeconds(1)),refreshed);
        assertThrows(ResponseStatusException.class, () -> run(() -> duty.requireAbsence(clinic)));
        assertEquals(10,balance());
        assertEquals(0,rows("dispensing_records"));
    }

    @Test void dutyChangesCannotRacePastPrescriberDispensing() throws Exception {
        receive(10,"LOT",LocalDate.of(2027,1,1));
        when(staff.getLicenseStatus(actor)).thenReturn(new StaffService.LicenseStatus(true,true));
        when(users.findRoleNames(actor)).thenReturn(List.of("Medical Officer"));
        run(() -> duty.record(clinic,actor,"NO_DISPENSER",1,"No dispenser present"));
        var rx=prescription(2);
        var locked=new CountDownLatch(1);
        var release=new CountDownLatch(1);
        var shiftStarted=new CountDownLatch(1);
        try(var pool=Executors.newFixedThreadPool(2)) {
            var dispense=pool.submit(() -> run(() -> {
                duty.requireAbsence(clinic);
                locked.countDown();
                try { if(!release.await(10,TimeUnit.SECONDS)) throw new AssertionError("Timed out releasing clinic lock"); }
                catch(InterruptedException e) { Thread.currentThread().interrupt(); throw new RuntimeException(e); }
                prescriptions.dispenseItem(rx.id(),rx.items().getFirst(),actor,product,true,true);
                return true;
            }));
            assertTrue(locked.await(10,TimeUnit.SECONDS));
            var shift=pool.submit(() -> { shiftStarted.countDown(); return run(() -> duty.record(clinic,actor,"ON_DUTY",8,"Shift arrival")); });
            assertTrue(shiftStarted.await(10,TimeUnit.SECONDS));
            try { assertThrows(TimeoutException.class, () -> shift.get(200,TimeUnit.MILLISECONDS)); }
            finally { release.countDown(); }
            assertTrue(dispense.get(15,TimeUnit.SECONDS));
            assertNotNull(shift.get(15,TimeUnit.SECONDS));
        }
        assertEquals(8,balance());
        assertEquals("ON_DUTY",run(() -> duty.status(clinic,actor)).status());
        assertThrows(ResponseStatusException.class, () -> run(() -> duty.requireAbsence(clinic)));
    }

    @Test void dutyLicencesAndReportDatesAreEnforced() {
        when(staff.getLicenseStatus(actor)).thenReturn(new StaffService.LicenseStatus(false,false));
        assertThrows(NotLicensedException.class, () -> run(() -> duty.record(clinic,actor,"ON_DUTY",8,"Shift")));
        assertThrows(NotLicensedException.class, () -> run(() -> duty.record(clinic,actor,"NO_DISPENSER",1,"No staff")));
        assertThrows(ResponseStatusException.class, () -> run(() -> report.report(clinic,LocalDate.now(),LocalDate.now().minusDays(1),0,25)));
    }

    @Test void unlicensedOrNonPrescriberRolesCannotUseTheFallback() {
        receive(10, "LOT", LocalDate.of(2027, 1, 1));
        var rx = prescription(2);
        when(staff.getLicenseStatus(actor)).thenReturn(new StaffService.LicenseStatus(true, false));
        when(users.findRoleNames(actor)).thenReturn(List.of("Stock Control Manager"));
        assertThrows(NotAClinicalRoleException.class, () -> run(() -> {
            prescriptions.dispenseItem(rx.id(), rx.items().getFirst(), actor, product, true, true); return null;
        }));
        when(users.findRoleNames(actor)).thenReturn(List.of("Doctor"));
        when(staff.getLicenseStatus(actor)).thenReturn(new StaffService.LicenseStatus(false, false));
        assertThrows(NotLicensedException.class, () -> run(() -> {
            prescriptions.dispenseItem(rx.id(), rx.items().getFirst(), actor, product, true, true); return null;
        }));
        assertEquals(10, balance()); assertEquals(0, rows("dispensing_records"));
    }
}
