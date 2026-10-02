package co.ehealth.platform.triage;

import org.hibernate.cfg.Configuration;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;

import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.DriverManager;
import java.time.Instant;
import java.util.Set;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

/** Runs against an isolated PostgreSQL instance; never targets an application schema. */
@EnabledIfEnvironmentVariable(named = "VITALS_TEST_JDBC_URL", matches = ".+")
class VitalsPersistenceTest {
    @Test void migrationAndHibernateRoundTripPreserveEveryNewField() throws Exception {
        String url = System.getenv("VITALS_TEST_JDBC_URL");
        String schema = "vitals_test_" + UUID.randomUUID().toString().replace("-", "");
        UUID visitId = UUID.randomUUID();
        try (var connection = DriverManager.getConnection(url); var sql = connection.createStatement()) {
            sql.execute("CREATE SCHEMA " + schema);
            try {
                sql.execute("SET search_path TO " + schema);
                sql.execute("CREATE TABLE visits(id UUID PRIMARY KEY)");
                sql.execute("INSERT INTO visits VALUES ('" + visitId + "')");
                for (String migration : new String[]{"V22__triage_assessments.sql", "V23__triage_validation_confirmation.sql", "V25__additional_vitals.sql"}) {
                    sql.execute(Files.readString(Path.of("src/main/resources/db/migration/tenant", migration)));
                }
                var config = new Configuration().addAnnotatedClass(TriageAssessment.class)
                        .setProperty("hibernate.connection.url", url)
                        .setProperty("hibernate.default_schema", schema)
                        .setProperty("hibernate.hbm2ddl.auto", "validate");
                try (var factory = config.buildSessionFactory()) {
                    var a = new TriageAssessment(visitId, false, null, ScoringProfile.ADULT, false, 18, 80, 120, 80,
                            37.0, 98, OxygenSupport.ROOM_AIR, null, null, Avpu.ALERT, Mobility.WALKING, 0, "NRS",
                            "Test observation", false, null, Set.of(), 1, TewsCalculator.SCORING_VERSION,
                            TriageColour.GREEN, TriageColour.GREEN, UUID.randomUUID(), Instant.now(), Instant.now(), UUID.randomUUID().toString());
                    var additional = new AdditionalObservations();
                    additional.traumaPresent = true; additional.weightKg = 72.5; additional.heightCm = 170.0;
                    additional.glucoseMmolL = 5.6; additional.haemoglobinGdl = 12.3;
                    additional.urineProtein = "TRACE"; additional.urineGlucose = "NEGATIVE";
                    additional.urineKetones = "ONE_PLUS"; additional.urineBlood = "TWO_PLUS";
                    additional.urineLeukocytes = "THREE_PLUS"; additional.urineNitrites = "POSITIVE";
                    additional.pregnancyTest = "INDETERMINATE"; a.setAdditionalObservations(additional);
                    try (var session = factory.openSession()) {
                        var tx = session.beginTransaction(); session.persist(a); tx.commit();
                    }
                    try (var session = factory.openSession()) {
                        var loaded = session.find(TriageAssessment.class, a.getId());
                        var b = TriageController.TriageAssessmentResponse.from(loaded).additionalObservations();
                        for (var field : AdditionalObservations.class.getFields()) assertEquals(field.get(additional), field.get(b), field.getName());
                        assertEquals(25.1, b.getBmi());
                    }
                    // A historical/partial row must keep null rather than inventing negative results.
                    sql.execute("UPDATE triage_assessments SET trauma_present=NULL, weight_kg=NULL, height_cm=NULL, glucose_mmol_l=NULL, haemoglobin_gdl=NULL, urine_protein=NULL, urine_glucose=NULL, urine_ketones=NULL, urine_blood=NULL, urine_leukocytes=NULL, urine_nitrites=NULL, pregnancy_test=NULL");
                    try (var session = factory.openSession()) {
                        assertNull(session.find(TriageAssessment.class, a.getId()).getAdditionalObservations());
                    }
                }
            } finally { sql.execute("DROP SCHEMA " + schema + " CASCADE"); }
        }
    }
}
