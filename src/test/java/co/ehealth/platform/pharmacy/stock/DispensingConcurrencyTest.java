package co.ehealth.platform.pharmacy.stock;

import org.hibernate.cfg.Configuration;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.orm.jpa.JpaTransactionManager;
import org.springframework.orm.jpa.SharedEntityManagerCreator;
import org.springframework.data.jpa.repository.support.JpaRepositoryFactory;
import org.springframework.transaction.support.TransactionTemplate;
import java.sql.DriverManager;
import java.time.Clock;
import java.util.*;
import java.util.concurrent.*;
import static org.junit.jupiter.api.Assertions.*;

@EnabledIfEnvironmentVariable(named = "PHARMACY_TEST_JDBC_URL", matches = ".+")
class DispensingConcurrencyTest {
    @Test void concurrentPartialDispensesAndRollbackKeepLedgerConsistent() throws Exception {
        String url = System.getenv("PHARMACY_TEST_JDBC_URL");
        String schema = "dispense_test_" + UUID.randomUUID().toString().replace("-", "");
        var credentials = new Properties();
        if (System.getenv("PHARMACY_TEST_DB_USER") != null) credentials.setProperty("user", System.getenv("PHARMACY_TEST_DB_USER"));
        if (System.getenv("PHARMACY_TEST_DB_PASSWORD") != null) credentials.setProperty("password", System.getenv("PHARMACY_TEST_DB_PASSWORD"));
        try (var connection = DriverManager.getConnection(url, credentials); var sql = connection.createStatement()) {
            sql.execute("CREATE SCHEMA " + schema);
            try {
                sql.execute("SET search_path TO " + schema);
                sql.execute("CREATE TABLE prescription_items(quantity INTEGER NOT NULL, status VARCHAR(20) NOT NULL)");
                sql.execute("INSERT INTO prescription_items VALUES (30,'DISPENSED'),(30,'PENDING')");
                sql.execute(java.nio.file.Files.readString(java.nio.file.Path.of(
                        "src/main/resources/db/migration/tenant/V37__partial_dispensing.sql")));
                try (var rows = sql.executeQuery("SELECT dispensed_quantity FROM prescription_items ORDER BY status")) {
                    assertTrue(rows.next()); assertEquals(30, rows.getInt(1));
                    assertTrue(rows.next()); assertEquals(0, rows.getInt(1));
                }
                assertThrows(java.sql.SQLException.class, () -> sql.execute("UPDATE prescription_items SET dispensed_quantity=31"));
                var config = new Configuration().addAnnotatedClass(PharmacyStockAccount.class)
                        .addAnnotatedClass(PharmacyStockLocation.class).addAnnotatedClass(PharmacyStockTransaction.class).addAnnotatedClass(PharmacyStockEntry.class)
                        .setProperty("hibernate.connection.url", url + (url.contains("?") ? "&" : "?") + "currentSchema=" + schema)
                        .setProperty("hibernate.default_schema", schema).setProperty("hibernate.hbm2ddl.auto", "create")
                        .setProperty("hibernate.connection.pool_size", "8");
                if (credentials.containsKey("user")) config.setProperty("hibernate.connection.username", credentials.getProperty("user"));
                if (credentials.containsKey("password")) config.setProperty("hibernate.connection.password", credentials.getProperty("password"));
                try (var factory = config.buildSessionFactory()) {
                    sql.execute("ALTER TABLE " + schema + ".pharmacy_stock_accounts ALTER COLUMN id SET DEFAULT gen_random_uuid()");
                    sql.execute("ALTER TABLE " + schema + ".pharmacy_stock_accounts ADD UNIQUE(product_id,batch_id,location_id,bucket)");
                    sql.execute("ALTER TABLE " + schema + ".pharmacy_stock_entries ALTER COLUMN seq SET DEFAULT 0");
                    var em = SharedEntityManagerCreator.createSharedEntityManager(factory);
                    var repositories = new JpaRepositoryFactory(em);
                    var accounts = repositories.getRepository(PharmacyStockAccountRepository.class);
                    var transactions = repositories.getRepository(PharmacyStockTransactionRepository.class);
                    var entries = repositories.getRepository(PharmacyStockEntryRepository.class);
                    var ledger = new PharmacyStockLedgerService(accounts, transactions, entries, Clock.systemUTC());
                    var tx = new TransactionTemplate(new JpaTransactionManager(factory));
                    UUID product = UUID.randomUUID(), batch = UUID.randomUUID(), location = UUID.randomUUID();
                    UUID facility = UUID.randomUUID(), actor = UUID.randomUUID();
                    java.util.function.LongConsumer post = amount -> ledger.postEntries(StockTransactionType.DISPENSE,
                            facility, actor, "Pharmacist", null, "test", UUID.randomUUID().toString(), "hash",
                            List.of(new PharmacyStockLedgerService.EntryRequest(product, batch, location, StockBucket.AVAILABLE, amount)));
                    tx.executeWithoutResult(status -> post.accept(30));
                    var ready = new CountDownLatch(2);
                    var start = new CountDownLatch(1);
                    try (var executor = Executors.newFixedThreadPool(2)) {
                        List<Future<?>> futures = new ArrayList<>();
                        for (long quantity : new long[]{7, 11}) futures.add(executor.submit(() -> {
                            ready.countDown();
                            try { assertTrue(start.await(10, TimeUnit.SECONDS)); }
                            catch (InterruptedException e) { throw new RuntimeException(e); }
                            tx.executeWithoutResult(status -> post.accept(-quantity));
                        }));
                        assertTrue(ready.await(10, TimeUnit.SECONDS)); start.countDown();
                        for (var future : futures) future.get(20, TimeUnit.SECONDS);
                    }
                    tx.executeWithoutResult(status -> {
                        assertEquals(12, accounts.findByProductIdAndLocationId(product, location).getFirst().getQuantity());
                        var movements = entries.findAll();
                        assertEquals(3, movements.size());
                        assertEquals(12, movements.stream().mapToLong(PharmacyStockEntry::getQuantityDelta).sum());
                        var debits = movements.stream().filter(e -> e.getQuantityDelta() < 0)
                                .sorted(Comparator.comparingLong(PharmacyStockEntry::getBalanceBefore).reversed()).toList();
                        assertEquals(30, debits.getFirst().getBalanceBefore());
                        assertEquals(debits.getFirst().getBalanceAfter(), debits.getLast().getBalanceBefore());
                        assertEquals(12, debits.getLast().getBalanceAfter());
                    });
                    assertThrows(InsufficientStockException.class, () -> tx.executeWithoutResult(status -> post.accept(-13)));
                    assertThrows(IllegalStateException.class, () -> tx.executeWithoutResult(status -> {
                        post.accept(-2); throw new IllegalStateException("later dispensing write failed");
                    }));
                    tx.executeWithoutResult(status -> {
                        assertEquals(12, accounts.findByProductIdAndLocationId(product, location).getFirst().getQuantity());
                        assertEquals(3, entries.count()); assertEquals(3, transactions.count());
                    });
                }
            } finally { sql.execute("DROP SCHEMA " + schema + " CASCADE"); }
        }
    }
}
