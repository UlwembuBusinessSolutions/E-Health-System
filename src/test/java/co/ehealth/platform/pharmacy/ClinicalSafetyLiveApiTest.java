package co.ehealth.platform.pharmacy;

import co.ehealth.platform.PlatformApplication;
import co.ehealth.platform.core.tenant.TenantMigrationRunner;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.boot.builder.SpringApplicationBuilder;
import org.springframework.boot.web.servlet.context.ServletWebServerApplicationContext;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.security.crypto.password.PasswordEncoder;
import java.net.*;
import java.net.http.*;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.*;
import java.util.*;
import static org.assertj.core.api.Assertions.assertThat;

/** Real HTTP acceptance test for PHRM-US-003; it owns and drops its temporary database. */
@EnabledIfSystemProperty(named = "clinical.safety.live.tests", matches = "true")
class ClinicalSafetyLiveApiTest {
    private final ObjectMapper json = new ObjectMapper();
    private final HttpClient http = HttpClient.newHttpClient();
    private final String password = "ClinicalLive-" + UUID.randomUUID();
    private String baseUrl;

    @Test
    void evaluates_interactions_and_contraindications_at_prescribing_and_dispensing() throws Exception {
        // Keep live-test defaults aligned with application.yml; callers can still override all three.
        String url = System.getProperty("clinical.safety.db.url", "jdbc:postgresql://localhost:5432/ulwembus");
        String user = System.getProperty("clinical.safety.db.username", "postgres");
        String password = System.getProperty("clinical.safety.db.password", "Linhle@12");
        String database = "live_clinical_safety_" + UUID.randomUUID().toString().replace("-", "");
        JdbcTemplate admin = new JdbcTemplate(new DriverManagerDataSource(url, user, password));
        admin.execute("CREATE DATABASE " + database);
        ServletWebServerApplicationContext app = null;
        try {
            String testUrl = url.substring(0, url.lastIndexOf('/') + 1) + database;
            app = (ServletWebServerApplicationContext) new SpringApplicationBuilder(PlatformApplication.class).run(
                    "--spring.config.location=classpath:queue-live-test.properties", "--server.port=0",
                    "--spring.datasource.url=" + testUrl, "--spring.datasource.username=" + user,
                    "--spring.datasource.password=" + password, "--app.jwt.secret=" + UUID.randomUUID() + UUID.randomUUID(),
                    "--app.platform.jwt-secret=" + UUID.randomUUID() + UUID.randomUUID());
            baseUrl = "http://localhost:" + app.getWebServer().getPort();
            JdbcTemplate db = new JdbcTemplate(new DriverManagerDataSource(testUrl, user, password));
            app.getBean(TenantMigrationRunner.class).provisionTenantSchema("clinical_live");
            db.update("insert into control.organizations (slug, schema_name, display_name, sector) values ('clinical-live', 'clinical_live', 'Clinical test', 'PUBLIC')");
            assertThat(db.queryForObject("select count(*) from clinical_live.flyway_schema_history where version = '25' and success", Integer.class)).isEqualTo(1);
            UUID clinic = UUID.randomUUID();
            db.update("insert into clinical_live.facilities (id, name, code, type) values (?, 'Clinical test clinic', 'CT', 'CLINIC')", clinic);
            String passwordHash = app.getBean(PasswordEncoder.class).encode(this.password);
            nurse(db, passwordHash, clinic);
            pharmacist(db, passwordHash, clinic);
            // The production nurse role is read-only for registration; grant only the temporary test role
            // PREG:MANAGE permission so this one API principal can create its synthetic patient.
            db.update("insert into clinical_live.role_permissions (role_id, permission_id) select r.id, p.id from clinical_live.roles r, clinical_live.permissions p where r.name = 'Professional Nurse' and p.code = 'PREG:MANAGE'");
            String token = login("nurse@clinical.live");
            String pharmacistToken = login("pharmacist@clinical.live");
            JsonNode patient = call("register patient", "POST", "/api/v1/patients", token, clinic, Map.of(
                    "firstName", "Clinical", "lastName", "Smoke", "idNumber", validId("850101100208"),
                    "address", "Test address", "contactNumber", "+27821234567"), 201);
            String patientId = patient.path("id").asText();
            JsonNode visitResponse = call("create visit", "POST", "/api/v1/visits", token, clinic, Map.of(
                    "patientId", patientId, "facilityId", clinic.toString(), "visitType", "NEW", "serviceStream", "GENERAL"), 201);
            String visitId = visitResponse.path("visit").path("id").asText();
            rule(token, clinic, "DRUG_INTERACTION", "Warfarin", "Ibuprofen", null, "HIGH", "Bleeding risk");
            rule(token, clinic, "CONTRAINDICATION", "Amoxicillin", null, "Penicillin allergy", "CRITICAL", "Allergy risk");
            call("record allergy", "POST", "/api/v1/clinical-safety/patients/" + patientId + "/facts", token, clinic,
                    Map.of("type", "ALLERGY", "term", "Penicillin allergy"), 201);
            List<Map<String, Object>> medicines = List.of(item("Warfarin"), item("Ibuprofen"), item("Amoxicillin"));
            JsonNode preview = call("preview ranked alerts", "POST", "/api/v1/prescriptions/safety-check", token, clinic,
                    Map.of("patientId", patientId, "items", medicines), 200);
            assertThat(preview.path("alerts").size()).isEqualTo(2);
            assertThat(preview.path("alerts").get(0).path("severity").asText()).isEqualTo("CRITICAL");

            if (Boolean.getBoolean("clinical.safety.browser.hold")) {
                Path ready = Path.of("target", "clinical-safety-browser-fixture.json");
                Path done = Path.of("target", "clinical-safety-browser.done");
                Files.deleteIfExists(done);
                json.writeValue(ready.toFile(), Map.of(
                        "baseUrl", baseUrl, "tenant", "clinical-live", "clinicId", clinic.toString(),
                        "password", this.password, "nurseEmail", "nurse@clinical.live",
                        "pharmacistEmail", "pharmacist@clinical.live", "patientId", patientId, "visitId", visitId,
                        "drugs", List.of("Warfarin", "Ibuprofen", "Amoxicillin")));
                System.out.println("[CLINICAL LIVE API] Browser fixture ready");
                long deadline = System.currentTimeMillis() + Duration.ofMinutes(10).toMillis();
                while (!Files.exists(done) && System.currentTimeMillis() < deadline) Thread.sleep(1000);
                assertThat(Files.exists(done)).as("Browser verification completed before timeout").isTrue();
                assertThat(Files.readString(done)).isEqualTo("PASS");
                assertThat(db.queryForObject("select count(*) from clinical_live.audit_log where action = 'CLINICAL_ALERT_OVERRIDDEN' and entity_id = ?", Integer.class, patientId)).isEqualTo(2);
                assertThat(db.queryForObject("select count(*) from clinical_live.prescriptions where patient_id = ? and status = 'DISPENSED'", Integer.class, UUID.fromString(patientId))).isEqualTo(1);
                Files.deleteIfExists(ready);
                Files.deleteIfExists(done);
                System.out.println("[CLINICAL LIVE API] PASS: browser prescribing + dispensing safety workflow");
                return;
            }

            Map<String, Object> prescription = new HashMap<>(); prescription.put("visitId", visitId); prescription.put("items", medicines);
            call("block unreasoned high alert", "POST", "/api/v1/prescriptions", token, clinic, prescription, 409);
            prescription.put("overrideReason", "Prescriber reviewed benefit versus risk");
            String prescriptionId = call("prescribe with override", "POST", "/api/v1/prescriptions", token, clinic, prescription, 201).path("id").asText();
            call("block unreasoned dispensing", "POST", "/api/v1/prescriptions/" + prescriptionId + "/dispense", pharmacistToken, clinic, null, 409);
            call("dispense with override", "POST", "/api/v1/prescriptions/" + prescriptionId + "/dispense", pharmacistToken, clinic,
                    Map.of("overrideReason", "Pharmacist confirmed prescriber decision"), 204);
            assertThat(db.queryForObject("select count(*) from clinical_live.audit_log where action = 'CLINICAL_ALERT_OVERRIDDEN' and entity_id = ?", Integer.class, patientId)).isEqualTo(2);
            assertThat(db.queryForObject("select status from clinical_live.prescriptions where id = ?", String.class, UUID.fromString(prescriptionId))).isEqualTo("DISPENSED");
            System.out.println("[CLINICAL LIVE API] PASS: migration, reference data, facts, ranked alerts, blocking, override audit, dispense");
        } finally {
            if (app != null) app.close();
            admin.execute("DROP DATABASE " + database + " WITH (FORCE)");
        }
    }
    private void rule(String token, UUID clinic, String type, String drug, String related, String term, String severity, String message) throws Exception {
        Map<String, Object> body = new HashMap<>(); body.put("type", type); body.put("drugName", drug); body.put("severity", severity); body.put("message", message);
        if (related != null) body.put("relatedDrugName", related); if (term != null) body.put("clinicalTerm", term);
        call("add " + type, "POST", "/api/v1/clinical-safety/rules", token, clinic, body, 201);
    }
    private Map<String, Object> item(String name) { return Map.of("drugName", name, "dosage", "1 tablet", "quantity", 1); }
    private String login(String email) throws Exception { return call("login", "POST", "/api/v1/auth/login", null, null, Map.of("email", email, "password", password), 200).path("accessToken").asText(); }
    private JsonNode call(String label, String method, String path, String token, UUID clinic, Object body, int expected) throws Exception {
        HttpRequest.Builder builder = HttpRequest.newBuilder(URI.create(baseUrl + path)).timeout(Duration.ofSeconds(30)).header("X-Tenant-ID", "clinical-live").header("Content-Type", "application/json");
        if (token != null) builder.header("Authorization", "Bearer " + token); if (clinic != null) builder.header("X-Clinic-ID", clinic.toString());
        HttpResponse<String> response = http.send(builder.method(method, body == null ? HttpRequest.BodyPublishers.noBody() : HttpRequest.BodyPublishers.ofString(json.writeValueAsString(body))).build(), HttpResponse.BodyHandlers.ofString());
        assertThat(response.statusCode()).as(label).isEqualTo(expected); System.out.println("[CLINICAL LIVE API] " + label + " => " + response.statusCode());
        return response.body().isBlank() ? json.createObjectNode() : json.readTree(response.body());
    }
    private UUID nurse(JdbcTemplate db, String hash, UUID clinic) {
        UUID id = UUID.randomUUID();
        db.update("insert into clinical_live.users (id, employee_number, email, first_name, last_name, contact_number, password_hash, facility_id, sanc_number, sanc_expiry_date) values (?, 'nurse', 'nurse@clinical.live', 'Clinical', 'Nurse', '+27821234567', ?, ?, 'SANC-LIVE', current_date + 30)", id, hash, clinic);
        db.update("insert into clinical_live.user_roles (user_id, role_id, facility_id) select ?, id, ? from clinical_live.roles where name = 'Professional Nurse'", id, clinic);
        db.update("insert into clinical_live.user_facilities values (?, ?)", id, clinic); return id;
    }
    private UUID pharmacist(JdbcTemplate db, String hash, UUID clinic) {
        UUID id = UUID.randomUUID();
        db.update("insert into clinical_live.users (id, employee_number, email, first_name, last_name, contact_number, password_hash, facility_id, sapc_number, sapc_expiry_date) values (?, 'pharmacist', 'pharmacist@clinical.live', 'Clinical', 'Pharmacist', '+27821234568', ?, ?, 'SAPC-LIVE', current_date + 30)", id, hash, clinic);
        db.update("insert into clinical_live.user_roles (user_id, role_id, facility_id) select ?, id, ? from clinical_live.roles where name = 'Pharmacist'", id, clinic);
        db.update("insert into clinical_live.user_facilities values (?, ?)", id, clinic); return id;
    }
    private String validId(String prefix) { int sum = 0; for (int i = 0; i < prefix.length(); i++) { int n = prefix.charAt(i) - '0'; if (i % 2 == 1) n *= 2; sum += n / 10 + n % 10; } return prefix + ((10 - sum % 10) % 10); }
}
