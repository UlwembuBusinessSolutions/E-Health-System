package co.ehealth.platform.pharmacy;

import org.hibernate.cfg.Configuration;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.data.jpa.repository.support.JpaRepositoryFactory;
import org.springframework.orm.jpa.JpaTransactionManager;
import org.springframework.orm.jpa.SharedEntityManagerCreator;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.transaction.support.TransactionTemplate;
import java.nio.file.*;
import java.sql.*;
import java.time.*;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;

@EnabledIfEnvironmentVariable(named = "PHARMACY_TEST_JDBC_URL", matches = ".+")
class DeclineDispensingDatabaseTest {
    @Test void migrationAndRealRepositoryDetectActiveCrossClinicSupplies() throws Exception {
        String url = System.getenv("PHARMACY_TEST_JDBC_URL");
        String schema = "decline_test_" + UUID.randomUUID().toString().replace("-", "");
        var credentials = new Properties();
        if (System.getenv("PHARMACY_TEST_DB_USER") != null) credentials.setProperty("user", System.getenv("PHARMACY_TEST_DB_USER"));
        if (System.getenv("PHARMACY_TEST_DB_PASSWORD") != null) credentials.setProperty("password", System.getenv("PHARMACY_TEST_DB_PASSWORD"));
        try (var connection = DriverManager.getConnection(url, credentials); var sql = connection.createStatement()) {
            sql.execute("CREATE SCHEMA " + schema);
            try {
                sql.execute("SET search_path TO " + schema);
                sql.execute("CREATE TABLE patients(id UUID PRIMARY KEY)");
                sql.execute("CREATE TABLE facilities(id UUID PRIMARY KEY)");
                sql.execute("CREATE TABLE pharmacy_products(id UUID PRIMARY KEY)");
                sql.execute("CREATE TABLE prescriptions(id UUID PRIMARY KEY, patient_id UUID, facility_id UUID)");
                sql.execute("CREATE TABLE prescription_items(id UUID PRIMARY KEY, status VARCHAR(20) NOT NULL, prescription_id UUID, product_id UUID, drug_name VARCHAR(200), dispensed_quantity INTEGER)");
                sql.execute("CREATE TABLE dispensing_records(prescription_item_id UUID, dispensed_at TIMESTAMPTZ)");
                sql.execute(Files.readString(Path.of("src/main/resources/db/migration/tenant/V39__decline_dispensing.sql")));
                UUID patient = UUID.randomUUID(), otherPatient = UUID.randomUUID(), product = UUID.randomUUID(), otherProduct = UUID.randomUUID();
                UUID clinicA = UUID.randomUUID(), clinicB = UUID.randomUUID(), actor = UUID.randomUUID();
                sql.execute("INSERT INTO patients VALUES ('" + patient + "'),('" + otherPatient + "')");
                sql.execute("INSERT INTO facilities VALUES ('" + clinicA + "'),('" + clinicB + "')");
                sql.execute("INSERT INTO pharmacy_products VALUES ('" + product + "'),('" + otherProduct + "')");
                var config = new Configuration().addAnnotatedClass(PrescriptionSupply.class)
                        .setProperty("hibernate.connection.url", url + (url.contains("?") ? "&" : "?") + "currentSchema=" + schema)
                        .setProperty("hibernate.default_schema", schema).setProperty("hibernate.hbm2ddl.auto", "validate");
                if (credentials.containsKey("user")) config.setProperty("hibernate.connection.username", credentials.getProperty("user"));
                if (credentials.containsKey("password")) config.setProperty("hibernate.connection.password", credentials.getProperty("password"));
                try (var factory = config.buildSessionFactory()) {
                    var repo = new JpaRepositoryFactory(SharedEntityManagerCreator.createSharedEntityManager(factory)).getRepository(PrescriptionSupplyRepository.class);
                    var tx = new TransactionTemplate(new JpaTransactionManager(factory));
                    var today = LocalDate.of(2026, 10, 1);
                    var events = new ArrayList<PrescriptionSupply>();
                    // Boundary-day supply, later coverage, expired coverage, unrelated product, unrelated patient.
                    for (int n = 0; n < 5; n++) {
                        var p = new Prescription("RX-" + n, UUID.randomUUID(), n == 4 ? otherPatient : patient,
                                n % 2 == 0 ? clinicA : clinicB, actor, Instant.parse("2026-09-30T10:00:00Z"));
                        var item = new PrescriptionItem(UUID.randomUUID(), "Medicine", "Daily", 30);
                        UUID itemId = UUID.randomUUID(); ReflectionTestUtils.setField(item, "id", itemId);
                        item.review(n == 3 ? otherProduct : product, ClinicalCheckStatus.PASSED, "Checked", actor, p.getCreatedAt());
                        sql.execute("INSERT INTO prescription_items(id,status) VALUES ('" + itemId + "','PENDING')");
                        events.add(new PrescriptionSupply(p, item, actor, p.getCreatedAt().plusSeconds(n),
                                n == 2 ? today.minusDays(1) : n == 0 ? today : today.plusDays(10), 7));
                    }
                    tx.executeWithoutResult(s -> repo.saveAll(events));
                    tx.executeWithoutResult(s -> {
                        var found = repo.findByPatientIdAndProductIdAndSupplyUntilGreaterThanEqualOrderByDispensedAtDesc(patient, product, today);
                        assertEquals(2, found.size()); assertEquals(clinicB, found.getFirst().getFacilityId());
                        assertEquals(today, found.getLast().getSupplyUntil());
                        assertTrue(repo.findByPatientIdAndProductIdAndSupplyUntilGreaterThanEqualOrderByDispensedAtDesc(patient, product, today.plusDays(11)).isEmpty());
                    });
                    UUID historicalRx = UUID.randomUUID(), historicalItem = UUID.randomUUID();
                    sql.execute("INSERT INTO prescriptions VALUES ('" + historicalRx + "','" + patient + "','" + clinicB + "')");
                    sql.execute("INSERT INTO prescription_items(id,status,prescription_id,drug_name,dispensed_quantity) VALUES ('"
                            + historicalItem + "','DISPENSED','" + historicalRx + "','  Medicine  ',30)");
                    sql.execute("INSERT INTO dispensing_records VALUES ('" + historicalItem + "','2026-09-30T10:00:00Z')");
                    tx.executeWithoutResult(s -> {
                        var history = repo.findHistoricalSupplies(patient, product, "medicine");
                        assertEquals(1, history.size()); assertEquals(clinicB, history.getFirst().getFacilityId());
                        assertEquals(Instant.parse("2026-09-30T10:00:00Z"), history.getFirst().getDispensedAt());
                        assertEquals(30, history.getFirst().getQuantity());
                        assertTrue(repo.findHistoricalSupplies(otherPatient, product, "medicine").isEmpty());
                    });
                    long before = repo.count();
                    assertThrows(IllegalStateException.class, () -> tx.executeWithoutResult(s -> {
                        repo.saveAndFlush(new PrescriptionSupply(new Prescription("rollback", UUID.randomUUID(), patient, clinicA, actor, Instant.now()),
                                mockItem(events.getFirst().getPrescriptionItemId(), product, actor), actor, Instant.now(), today, 1));
                        throw new IllegalStateException("Later dispensing write failed");
                    }));
                    assertEquals(before, repo.count());
                }
                assertThrows(SQLException.class, () -> sql.execute("UPDATE prescription_items SET status='DECLINED'"));
                UUID itemId = UUID.randomUUID();
                sql.execute("INSERT INTO prescription_items(id,status,decline_reason,declined_by,declined_at) VALUES ('" + itemId
                        + "','DECLINED','SUFFICIENT_MEDICATION','" + actor + "',now())");
                assertThrows(SQLException.class, () -> sql.execute("UPDATE prescription_items SET decline_reason='INVALID' WHERE id='" + itemId + "'"));
            } finally {
                // Only this test's freshly generated schema is removed.
                sql.execute("DROP SCHEMA " + schema + " CASCADE");
            }
        }
    }
    private PrescriptionItem mockItem(UUID id, UUID product, UUID actor) {
        var item = new PrescriptionItem(UUID.randomUUID(), "Medicine", "Daily", 30);
        ReflectionTestUtils.setField(item, "id", id);
        item.review(product, ClinicalCheckStatus.PASSED, "Checked", actor, Instant.now()); return item;
    }
}
