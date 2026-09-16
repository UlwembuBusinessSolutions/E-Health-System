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
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import static org.assertj.core.api.Assertions.assertThat;

/** Real HTTP acceptance test for PHRM-US-002; it owns and drops its temporary database. */
@EnabledIfSystemProperty(named = "prescription.query.live.tests", matches = "true")
class PrescriptionQueryLiveApiTest {
    private final ObjectMapper json = new ObjectMapper();
    private final HttpClient http = HttpClient.newHttpClient();
    private final String loginPassword = "QueryLive-" + UUID.randomUUID();
    private String baseUrl;

    @Test
    void queries_hold_notify_and_return_prescriptions_after_prescriber_response() throws Exception {
        String url = System.getProperty("prescription.query.db.url", "jdbc:postgresql://localhost:5432/ulwembus");
        String user = System.getProperty("prescription.query.db.username", "postgres");
        String password = System.getProperty("prescription.query.db.password", "Linhle@12");
        String database = "live_prescription_query_" + UUID.randomUUID().toString().replace("-", "");
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
            app.getBean(TenantMigrationRunner.class).provisionTenantSchema("query_live");
            db.update("insert into control.organizations (slug, schema_name, display_name, sector) values ('query-live', 'query_live', 'Query test', 'PUBLIC')");
            assertThat(db.queryForObject("select count(*) from query_live.flyway_schema_history where version = '26' and success", Integer.class)).isEqualTo(1);

            UUID clinic = UUID.randomUUID();
            db.update("insert into query_live.facilities (id, name, code, type) values (?, 'Query test clinic', 'QT', 'CLINIC')", clinic);
            String passwordHash = app.getBean(PasswordEncoder.class).encode(loginPassword);
            nurse(db, passwordHash, clinic);
            pharmacist(db, passwordHash, clinic);
            db.update("insert into query_live.role_permissions (role_id, permission_id) select r.id, p.id from query_live.roles r, query_live.permissions p where r.name = 'Professional Nurse' and p.code = 'PREG:MANAGE'");

            String nurseToken = login("nurse@query.live");
            String pharmacistToken = login("pharmacist@query.live");
            JsonNode patient = call("register patient", "POST", "/api/v1/patients", nurseToken, clinic, Map.of(
                    "firstName", "Query", "lastName", "Patient", "idNumber", validId("850101100208"),
                    "address", "Test address", "contactNumber", "+27821234567"), 201);
            String patientId = patient.path("id").asText();
            String visitId = call("create visit", "POST", "/api/v1/visits", nurseToken, clinic, Map.of(
                    "patientId", patientId, "facilityId", clinic.toString(), "visitType", "NEW", "serviceStream", "GENERAL"), 201)
                    .path("visit").path("id").asText();
            rule(nurseToken, clinic);
            Map<String, Object> prescriptionBody = Map.of(
                    "visitId", visitId,
                    "items", List.of(item("Warfarin"), item("Ibuprofen")),
                    "overrideReason", "Prescriber created the prescription for query workflow testing");
            String prescriptionId = call("create prescription", "POST", "/api/v1/prescriptions", nurseToken, clinic, prescriptionBody, 201).path("id").asText();

            if (Boolean.getBoolean("prescription.query.browser.hold")) {
                holdForBrowser(clinic, patientId, visitId, prescriptionId);
                assertThat(db.queryForObject("select status from query_live.prescriptions where id = ?", String.class, UUID.fromString(prescriptionId))).isEqualTo("PENDING");
                System.out.println("[PRESCRIPTION QUERY LIVE API] PASS: browser query workflow");
                return;
            }

            JsonNode preview = call("preview query warnings", "GET", "/api/v1/prescriptions/" + prescriptionId + "/query-preview", pharmacistToken, clinic, null, 200);
            assertThat(preview.path("alerts")).hasSize(1);
            JsonNode query = call("raise query", "POST", "/api/v1/prescriptions/" + prescriptionId + "/queries", pharmacistToken, clinic,
                    Map.of("reason", "Please confirm interaction risk before dispensing."), 201);
            String queryId = query.path("id").asText();
            assertThat(query.path("guidelineWarning").asText()).contains("Bleeding risk");
            assertThat(db.queryForObject("select status from query_live.prescriptions where id = ?", String.class, UUID.fromString(prescriptionId))).isEqualTo("HELD");
            assertThat(call("prescriber notifications", "GET", "/api/v1/prescription-query-notifications", nurseToken, clinic, null, 200).path("items")).hasSize(1);
            call("reject non-prescriber response", "POST", "/api/v1/prescription-queries/" + queryId + "/response", pharmacistToken, clinic,
                    Map.of("response", "No"), 403);
            call("prescriber responds", "POST", "/api/v1/prescription-queries/" + queryId + "/response", nurseToken, clinic,
                    Map.of("response", "Change accepted; reduce monitoring interval."), 200);
            JsonNode returned = call("prescription returned to queue", "GET", "/api/v1/prescriptions/" + prescriptionId, pharmacistToken, clinic, null, 200);
            assertThat(returned.path("status").asText()).isEqualTo("PENDING");
            assertThat(returned.path("latestQuery").path("prescriberResponse").asText()).contains("Change accepted");
            System.out.println("[PRESCRIPTION QUERY LIVE API] PASS: preview, hold, notify, authorize response, return to queue");
        } finally {
            if (app != null) app.close();
            admin.execute("DROP DATABASE " + database + " WITH (FORCE)");
        }
    }

    private void holdForBrowser(UUID clinic, String patientId, String visitId, String prescriptionId) throws Exception {
        Path ready = Path.of("target", "prescription-query-browser-fixture.json");
        Path done = Path.of("target", "prescription-query-browser.done");
        Files.deleteIfExists(done);
        json.writeValue(ready.toFile(), Map.of(
                "baseUrl", baseUrl, "tenant", "query-live", "clinicId", clinic.toString(),
                "password", loginPassword, "nurseEmail", "nurse@query.live", "pharmacistEmail", "pharmacist@query.live",
                "patientId", patientId, "visitId", visitId, "prescriptionId", prescriptionId));
        System.out.println("[PRESCRIPTION QUERY LIVE API] Browser fixture ready");
        long deadline = System.currentTimeMillis() + Duration.ofMinutes(10).toMillis();
        while (!Files.exists(done) && System.currentTimeMillis() < deadline) Thread.sleep(1000);
        assertThat(Files.exists(done)).as("Browser verification completed before timeout").isTrue();
        assertThat(Files.readString(done)).isEqualTo("PASS");
        Files.deleteIfExists(ready);
        Files.deleteIfExists(done);
    }

    private void rule(String token, UUID clinic) throws Exception {
        call("add interaction rule", "POST", "/api/v1/clinical-safety/rules", token, clinic,
                Map.of("type", "DRUG_INTERACTION", "drugName", "Warfarin", "relatedDrugName", "Ibuprofen",
                        "severity", "HIGH", "message", "Bleeding risk"), 201);
    }

    private Map<String, Object> item(String name) { return Map.of("drugName", name, "dosage", "1 tablet", "quantity", 1); }
    private String login(String email) throws Exception { return call("login", "POST", "/api/v1/auth/login", null, null, Map.of("email", email, "password", loginPassword), 200).path("accessToken").asText(); }

    private JsonNode call(String label, String method, String path, String token, UUID clinic, Object body, int expected) throws Exception {
        HttpRequest.Builder builder = HttpRequest.newBuilder(URI.create(baseUrl + path)).timeout(Duration.ofSeconds(30)).header("X-Tenant-ID", "query-live").header("Content-Type", "application/json");
        if (token != null) builder.header("Authorization", "Bearer " + token); if (clinic != null) builder.header("X-Clinic-ID", clinic.toString());
        HttpResponse<String> response = http.send(builder.method(method, body == null ? HttpRequest.BodyPublishers.noBody() : HttpRequest.BodyPublishers.ofString(json.writeValueAsString(body))).build(), HttpResponse.BodyHandlers.ofString());
        assertThat(response.statusCode()).as(label + ": " + response.body()).isEqualTo(expected); System.out.println("[PRESCRIPTION QUERY LIVE API] " + label + " => " + response.statusCode());
        return response.body().isBlank() ? json.createObjectNode() : json.readTree(response.body());
    }

    private UUID nurse(JdbcTemplate db, String hash, UUID clinic) {
        UUID id = UUID.randomUUID();
        db.update("insert into query_live.users (id, employee_number, email, first_name, last_name, contact_number, password_hash, facility_id, sanc_number, sanc_expiry_date) values (?, 'nurse', 'nurse@query.live', 'Query', 'Nurse', '+27821234567', ?, ?, 'SANC-QUERY', current_date + 30)", id, hash, clinic);
        db.update("insert into query_live.user_roles (user_id, role_id, facility_id) select ?, id, ? from query_live.roles where name = 'Professional Nurse'", id, clinic);
        db.update("insert into query_live.user_facilities values (?, ?)", id, clinic); return id;
    }

    private UUID pharmacist(JdbcTemplate db, String hash, UUID clinic) {
        UUID id = UUID.randomUUID();
        db.update("insert into query_live.users (id, employee_number, email, first_name, last_name, contact_number, password_hash, facility_id, sapc_number, sapc_expiry_date) values (?, 'pharmacist', 'pharmacist@query.live', 'Query', 'Pharmacist', '+27821234568', ?, ?, 'SAPC-QUERY', current_date + 30)", id, hash, clinic);
        db.update("insert into query_live.user_roles (user_id, role_id, facility_id) select ?, id, ? from query_live.roles where name = 'Pharmacist'", id, clinic);
        db.update("insert into query_live.user_facilities values (?, ?)", id, clinic); return id;
    }

    private String validId(String prefix) { int sum = 0; for (int i = 0; i < prefix.length(); i++) { int n = prefix.charAt(i) - '0'; if (i % 2 == 1) n *= 2; sum += n / 10 + n % 10; } return prefix + ((10 - sum % 10) % 10); }
}
