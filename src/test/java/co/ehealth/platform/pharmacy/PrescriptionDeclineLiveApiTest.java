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

/** Real HTTP acceptance test for PHRM-US-005; it owns and drops its temporary database. */
@EnabledIfSystemProperty(named = "prescription.decline.live.tests", matches = "true")
class PrescriptionDeclineLiveApiTest {
    private final ObjectMapper json = new ObjectMapper();
    private final HttpClient http = HttpClient.newHttpClient();
    private final String loginPassword = "DeclineLive-" + UUID.randomUUID();
    private String baseUrl;

    @Test
    void warns_across_clinics_and_records_a_decline_with_prescriber_notification() throws Exception {
        String url = System.getProperty("prescription.decline.db.url", "jdbc:postgresql://localhost:5432/ulwembus");
        String user = System.getProperty("prescription.decline.db.username", "postgres");
        String password = System.getProperty("prescription.decline.db.password", "Linhle@12");
        String database = "live_prescription_decline_" + UUID.randomUUID().toString().replace("-", "");
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
            app.getBean(TenantMigrationRunner.class).provisionTenantSchema("decline_live");
            db.update("insert into control.organizations (slug, schema_name, display_name, sector) values ('decline-live', 'decline_live', 'Decline test', 'PUBLIC')");
            assertThat(db.queryForObject("select count(*) from decline_live.flyway_schema_history where version = '27' and success", Integer.class)).isEqualTo(1);

            UUID clinic = UUID.randomUUID();
            db.update("insert into decline_live.facilities (id, name, code, type) values (?, 'Decline test clinic', 'DT', 'CLINIC')", clinic);
            UUID priorClinic = UUID.randomUUID();
            db.update("insert into decline_live.facilities (id, name, code, type) values (?, 'Other clinic', 'OC', 'CLINIC')", priorClinic);
            String passwordHash = app.getBean(PasswordEncoder.class).encode(loginPassword);
            UUID nurseId = nurse(db, passwordHash, clinic);
            UUID pharmacistId = pharmacist(db, passwordHash, clinic);
            db.update("insert into decline_live.role_permissions (role_id, permission_id) select r.id, p.id from decline_live.roles r, decline_live.permissions p where r.name = 'Professional Nurse' and p.code = 'PREG:MANAGE'");

            String nurseToken = login("nurse@query.live");
            String pharmacistToken = login("pharmacist@query.live");
            JsonNode patient = call("register patient", "POST", "/api/v1/patients", nurseToken, clinic, Map.of(
                    "firstName", "Decline", "lastName", "Patient", "idNumber", validId("850101100208"),
                    "address", "Test address", "contactNumber", "+27821234567"), 201);
            String patientId = patient.path("id").asText();
            String visitId = call("create visit", "POST", "/api/v1/visits", nurseToken, clinic, Map.of(
                    "patientId", patientId, "facilityId", clinic.toString(), "visitType", "NEW", "serviceStream", "GENERAL"), 201)
                    .path("visit").path("id").asText();
            UUID priorVisit = UUID.randomUUID(), priorPrescription = UUID.randomUUID();
            db.update("insert into decline_live.visits (id, patient_id, facility_id, visit_type, service_stream, visit_datetime) values (?, ?, ?, 'NEW', 'GENERAL', now() - interval '5 days')",
                    priorVisit, UUID.fromString(patientId), priorClinic);
            db.update("insert into decline_live.prescriptions (id, serial_number, visit_id, patient_id, facility_id, prescriber_id, status) values (?, 'RX-PRIOR-005', ?, ?, ?, ?, 'DISPENSED')",
                    priorPrescription, priorVisit, UUID.fromString(patientId), priorClinic, nurseId);
            db.update("insert into decline_live.prescription_items (prescription_id, drug_name, dosage, quantity) values (?, 'Amoxicillin', '500 mg', 20)", priorPrescription);
            db.update("insert into decline_live.dispensing_records (prescription_id, patient_id, patient_mpi, dispensed_by_user_id, dispensed_at, coverage_until) values (?, ?, ?, ?, now() - interval '5 days', current_date + 5)",
                    priorPrescription, UUID.fromString(patientId), patient.path("mpiNumber").asText(), pharmacistId);
            Map<String, Object> prescriptionBody = Map.of("visitId", visitId, "items", List.of(item("Amoxicillin")));
            String prescriptionId = call("create prescription", "POST", "/api/v1/prescriptions", nurseToken, clinic, prescriptionBody, 201).path("id").asText();

            if (Boolean.getBoolean("prescription.decline.browser.hold")) {
                holdForBrowser(clinic, patientId, visitId, prescriptionId);
                assertThat(db.queryForObject("select status from decline_live.prescriptions where id = ?", String.class, UUID.fromString(prescriptionId))).isEqualTo("DECLINED");
                assertThat(db.queryForObject("select count(*) from decline_live.prescription_decline_notifications where recipient_user_id = ?", Integer.class, nurseId)).isEqualTo(1);
                assertThat(db.queryForObject("select count(*) from decline_live.audit_log where action = 'PRESCRIPTION_DECLINED' and entity_id = ?", Integer.class, prescriptionId)).isEqualTo(1);
                System.out.println("[PRESCRIPTION DECLINE LIVE API] PASS: browser decline workflow");
                return;
            }
            JsonNode warnings = call("cross-clinic duplicate warnings", "GET", "/api/v1/prescriptions/" + prescriptionId + "/duplicate-warnings", pharmacistToken, clinic, null, 200);
            assertThat(warnings.path("items")).hasSize(1);
            assertThat(warnings.path("items").get(0).path("facilityId").asText()).isEqualTo(priorClinic.toString());
            assertThat(warnings.path("items").get(0).path("facilityName").asText()).isEqualTo("Other clinic");
            db.update("update decline_live.dispensing_records set coverage_until = current_date - 1 where prescription_id = ?", priorPrescription);
            assertThat(call("expired supply is excluded", "GET", "/api/v1/prescriptions/" + prescriptionId + "/duplicate-warnings", pharmacistToken, clinic, null, 200).path("items")).isEmpty();
            db.update("update decline_live.dispensing_records set coverage_until = current_date + 5 where prescription_id = ?", priorPrescription);
            call("missing reason", "POST", "/api/v1/prescriptions/" + prescriptionId + "/decline", pharmacistToken, clinic, Map.of(), 400);
            JsonNode decision = call("decline prescription", "POST", "/api/v1/prescriptions/" + prescriptionId + "/decline", pharmacistToken, clinic,
                    Map.of("reasonCode", "DUPLICATE_SUPPLY", "reasonDetail", "Patient still has medication"), 201);
            assertThat(decision.path("reasonCode").asText()).isEqualTo("DUPLICATE_SUPPLY");
            assertThat(call("prescriber notifications", "GET", "/api/v1/prescription-decline-notifications", nurseToken, clinic, null, 200).path("items")).hasSize(1);
            assertThat(call("recorded decision", "GET", "/api/v1/prescriptions/" + prescriptionId + "/decline", pharmacistToken, clinic, null, 200).path("reasonDetail").asText()).isEqualTo("Patient still has medication");
            assertThat(call("read status", "GET", "/api/v1/prescriptions/" + prescriptionId, pharmacistToken, clinic, null, 200).path("status").asText()).isEqualTo("DECLINED");
            assertThat(db.queryForObject("select count(*) from decline_live.stock_movements where prescription_id = ?", Integer.class, UUID.fromString(prescriptionId))).isZero();
            assertThat(db.queryForObject("select count(*) from decline_live.audit_log where action = 'PRESCRIPTION_DECLINED' and entity_id = ?", Integer.class, prescriptionId)).isEqualTo(1);
            System.out.println("[PRESCRIPTION DECLINE LIVE API] PASS: warning, reason, notification, no stock issue");
        } finally {
            if (app != null) app.close();
            admin.execute("DROP DATABASE " + database + " WITH (FORCE)");
        }
    }

    private void holdForBrowser(UUID clinic, String patientId, String visitId, String prescriptionId) throws Exception {
        Path ready = Path.of("target", "prescription-decline-browser-fixture.json");
        Path done = Path.of("target", "prescription-decline-browser.done");
        Files.deleteIfExists(done);
        json.writeValue(ready.toFile(), Map.of(
                "baseUrl", baseUrl, "tenant", "decline-live", "clinicId", clinic.toString(),
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

    private Map<String, Object> item(String name) { return Map.of("drugName", name, "dosage", "1 tablet", "quantity", 1); }
    private String login(String email) throws Exception { return call("login", "POST", "/api/v1/auth/login", null, null, Map.of("email", email, "password", loginPassword), 200).path("accessToken").asText(); }

    private JsonNode call(String label, String method, String path, String token, UUID clinic, Object body, int expected) throws Exception {
        HttpRequest.Builder builder = HttpRequest.newBuilder(URI.create(baseUrl + path)).timeout(Duration.ofSeconds(30)).header("X-Tenant-ID", "decline-live").header("Content-Type", "application/json");
        if (token != null) builder.header("Authorization", "Bearer " + token); if (clinic != null) builder.header("X-Clinic-ID", clinic.toString());
        HttpResponse<String> response = http.send(builder.method(method, body == null ? HttpRequest.BodyPublishers.noBody() : HttpRequest.BodyPublishers.ofString(json.writeValueAsString(body))).build(), HttpResponse.BodyHandlers.ofString());
        assertThat(response.statusCode()).as(label + ": " + response.body()).isEqualTo(expected); System.out.println("[PRESCRIPTION QUERY LIVE API] " + label + " => " + response.statusCode());
        return response.body().isBlank() ? json.createObjectNode() : json.readTree(response.body());
    }

    private UUID nurse(JdbcTemplate db, String hash, UUID clinic) {
        UUID id = UUID.randomUUID();
        db.update("insert into decline_live.users (id, employee_number, email, first_name, last_name, contact_number, password_hash, facility_id, sanc_number, sanc_expiry_date) values (?, 'nurse', 'nurse@query.live', 'Decline', 'Nurse', '+27821234567', ?, ?, 'SANC-QUERY', current_date + 30)", id, hash, clinic);
        db.update("insert into decline_live.user_roles (user_id, role_id, facility_id) select ?, id, ? from decline_live.roles where name = 'Professional Nurse'", id, clinic);
        db.update("insert into decline_live.user_facilities values (?, ?)", id, clinic); return id;
    }

    private UUID pharmacist(JdbcTemplate db, String hash, UUID clinic) {
        UUID id = UUID.randomUUID();
        db.update("insert into decline_live.users (id, employee_number, email, first_name, last_name, contact_number, password_hash, facility_id, sapc_number, sapc_expiry_date) values (?, 'pharmacist', 'pharmacist@query.live', 'Decline', 'Pharmacist', '+27821234568', ?, ?, 'SAPC-QUERY', current_date + 30)", id, hash, clinic);
        db.update("insert into decline_live.user_roles (user_id, role_id, facility_id) select ?, id, ? from decline_live.roles where name = 'Pharmacist'", id, clinic);
        db.update("insert into decline_live.user_facilities values (?, ?)", id, clinic); return id;
    }

    private String validId(String prefix) { int sum = 0; for (int i = 0; i < prefix.length(); i++) { int n = prefix.charAt(i) - '0'; if (i % 2 == 1) n *= 2; sum += n / 10 + n % 10; } return prefix + ((10 - sum % 10) % 10); }
}
