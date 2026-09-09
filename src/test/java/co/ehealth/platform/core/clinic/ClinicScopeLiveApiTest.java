package co.ehealth.platform.core.clinic;

import co.ehealth.platform.PlatformApplication;
import co.ehealth.platform.core.tenant.TenantMigrationRunner;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.beans.factory.config.YamlPropertiesFactoryBean;
import org.springframework.boot.builder.SpringApplicationBuilder;
import org.springframework.boot.web.servlet.context.ServletWebServerApplicationContext;
import org.springframework.core.env.StandardEnvironment;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

// Real TCP requests through Tomcat, tenant routing, JWT authentication and database-backed services.
@EnabledIfSystemProperty(named = "clinic.live.tests", matches = "true")
class ClinicScopeLiveApiTest {
    private final ObjectMapper json = new ObjectMapper();
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();
    private final String password = "LiveTest-" + UUID.randomUUID();
    private String baseUrl;

    @Test
    void liveClinicAssignmentSwitchingIsolationAndAudit() throws Exception {
        var yaml = new YamlPropertiesFactoryBean();
        yaml.setResources(new ClassPathResource("application.yml"));
        var properties = yaml.getObject();
        var environment = new StandardEnvironment();
        String url = environment.resolveRequiredPlaceholders(properties.getProperty("spring.datasource.url"));
        String username = environment.resolveRequiredPlaceholders(properties.getProperty("spring.datasource.username"));
        String secret = environment.resolveRequiredPlaceholders(properties.getProperty("spring.datasource.password"));
        String database = "live_clinic_test_" + UUID.randomUUID().toString().replace("-", "");
        String testUrl = url.substring(0, url.lastIndexOf('/') + 1) + database;
        JdbcTemplate adminDb = new JdbcTemplate(new DriverManagerDataSource(url, username, secret));
        adminDb.execute("CREATE DATABASE " + database);
        ServletWebServerApplicationContext app = null;
        try {
            app = (ServletWebServerApplicationContext) new SpringApplicationBuilder(PlatformApplication.class).run(
                    "--server.port=0", "--spring.profiles.active=live-api-test",
                    "--spring.datasource.url=" + testUrl, "--spring.datasource.username=" + username,
                    "--spring.datasource.password=" + secret, "--app.security.bcrypt-strength=4");
            baseUrl = "http://localhost:" + app.getWebServer().getPort();
            System.out.println("[LIVE API] Listening at " + baseUrl + " with an isolated test database");
            JdbcTemplate db = new JdbcTemplate(new DriverManagerDataSource(testUrl, username, secret));
            TenantMigrationRunner migrations = app.getBean(TenantMigrationRunner.class);
            migrations.provisionTenantSchema("live_a");
            migrations.provisionTenantSchema("live_b");
            for (String tenant : List.of("a", "b")) {
                db.update("insert into control.organizations (slug, schema_name, display_name, sector) "
                        + "values (?, ?, 'Live API Test', 'PUBLIC')", "smoke-" + tenant, "live_" + tenant);
            }
            UUID a = clinic(db, "A");
            UUID b = clinic(db, "B");
            String hash = app.getBean(PasswordEncoder.class).encode(password);
            user(db, "admin", hash, null, "ORG_ADMIN");
            user(db, "single", hash, a, "Admin Staff");
            UUID rotatingId = user(db, "rotating", hash, a, "Admin Staff");

            call("Health", "GET", "/actuator/health", null, null, null, 200);
            String admin = login("admin");
            String single = login("single");
            String rotating = login("rotating");
            JsonNode facilities = call("Single-clinic facility list", "GET", "/api/v1/facilities", single, null, null, 200);
            assertThat(facilities.path("items").size()).isEqualTo(1);
            assertThat(facilities.path("items").get(0).path("id").asText()).isEqualTo(a.toString());

            JsonNode patientA = call("Register patient in A", "POST", "/api/v1/patients", admin, a.toString(), patient("850101100208"), 201);
            JsonNode patientB = call("Register patient in B", "POST", "/api/v1/patients", admin, b.toString(), patient("860101100208"), 201);
            assertOnlyPatient(call("A-only patient search", "GET", "/api/v1/patients/search?q=ClinicSmoke", single, null, null, 200), patientA);
            call("Cross-clinic direct patient lookup", "GET", "/api/v1/patients/" + patientB.path("id").asText(), single, null, null, 404);
            call("Unassigned clinic selection", "PUT", "/api/v1/auth/clinic-context", single, b.toString(), null, 403);
            call("Malformed clinic header", "GET", "/api/v1/auth/clinic-context", single, "invalid", null, 400);
            String assignments = "/api/v1/admin/staff/" + rotatingId + "/clinics";
            Map<String, Object> both = Map.of("clinicIds", List.of(a, b), "primaryClinicId", a);
            call("Non-admin assignment denied", "PUT", assignments, single, null, both, 403);
            call("Admin assigns two clinics", "PUT", assignments, admin, a.toString(), both, 200);
            JsonNode assigned = call("Read staff clinic assignments", "GET", assignments, admin, a.toString(), null, 200);
            assertThat(assigned.path("clinicIds").size()).isEqualTo(2);
            assertThat(assigned.path("primaryClinicId").asText()).isEqualTo(a.toString());
            call("Non-admin cannot read staff clinic assignments", "GET", assignments, single, null, null, 403);
            JsonNode context = call("Existing token sees new assignments", "GET", "/api/v1/auth/clinic-context", rotating, null, null, 200);
            assertThat(context.path("clinicIds").size()).isEqualTo(2);
            call("Switch to B", "PUT", "/api/v1/auth/clinic-context", rotating, b.toString(), null, 200);
            assertOnlyPatient(call("B-context patient search", "GET", "/api/v1/patients/search?q=ClinicSmoke", rotating, b.toString(), null, 200), patientB);
            call("Switch back to A", "PUT", "/api/v1/auth/clinic-context", rotating, a.toString(), null, 200);
            assertOnlyPatient(call("A-context patient search", "GET", "/api/v1/patients/search?q=ClinicSmoke", rotating, a.toString(), null, 200), patientA);
            call("Admin revokes B", "PUT", assignments, admin, a.toString(), Map.of("clinicIds", List.of(a), "primaryClinicId", a), 200);
            call("Existing token loses B immediately", "GET", "/api/v1/patients/search?q=ClinicSmoke", rotating, b.toString(), null, 403);
            JsonNode audit = call("Read audit context", "GET", "/api/v1/admin/audit", admin, a.toString(), null, 200);
            boolean switchRecorded = false;
            boolean registrationRecorded = false;
            for (JsonNode row : audit.path("items")) {
                if (row.path("action").asText().equals("CLINIC_CONTEXT_SELECTED")
                        && row.path("clinicContextId").asText().equals(b.toString())) { switchRecorded = true; }
                if (row.path("action").asText().equals("PATIENT_REGISTERED")
                        && row.path("entityId").asText().equals(patientB.path("id").asText())
                        && row.path("clinicContextId").asText().equals(b.toString())) { registrationRecorded = true; }
            }
            assertThat(switchRecorded).as("Switch action records clinic B").isTrue();
            assertThat(registrationRecorded).as("Patient action records clinic B").isTrue();
            var crossTenant = http.send(HttpRequest.newBuilder(URI.create(baseUrl + "/api/v1/auth/clinic-context"))
                    .header("Authorization", "Bearer " + single).header("X-Tenant-ID", "smoke-b").GET().build(), HttpResponse.BodyHandlers.ofString());
            assertThat(crossTenant.statusCode()).isEqualTo(401);
            System.out.println("[LIVE API] Cross-tenant token rejected => 401");
            var cors = http.send(HttpRequest.newBuilder(URI.create(baseUrl + "/api/v1/auth/clinic-context"))
                    .header("Origin", "http://localhost:5173").header("Access-Control-Request-Method", "PUT")
                    .header("Access-Control-Request-Headers", "authorization,x-tenant-id,x-clinic-id")
                    .method("OPTIONS", HttpRequest.BodyPublishers.noBody()).build(), HttpResponse.BodyHandlers.ofString());
            assertThat(cors.statusCode()).isEqualTo(200);
            assertThat(cors.headers().firstValue("Access-Control-Allow-Headers").orElse("").toLowerCase()).contains("x-clinic-id");
            System.out.println("[LIVE API] Browser clinic-header preflight => 200");
            clinicalWorkflow(db, admin, a, b, patientA, patientB);
            if (Boolean.getBoolean("clinic.browser.hold")) {
                java.nio.file.Files.deleteIfExists(java.nio.file.Path.of("target", "clinic-browser.done"));
                var ready = java.nio.file.Path.of("target", "clinic-browser-fixture.json");
                json.writeValue(ready.toFile(), Map.of("baseUrl", baseUrl, "tenant", "smoke-a", "password", password,
                        "clinicA", a.toString(), "clinicB", b.toString(), "rotatingId", rotatingId.toString()));
                System.out.println("[LIVE API] Browser fixture ready");
                long deadline = System.nanoTime() + Duration.ofMinutes(10).toNanos();
                while (!java.nio.file.Files.exists(java.nio.file.Path.of("target", "clinic-browser.done"))
                        && System.nanoTime() < deadline) { Thread.sleep(1000); }
                java.nio.file.Files.deleteIfExists(ready);
            }
        } finally {
            if (app != null) { app.close(); }
            adminDb.execute("DROP DATABASE " + database + " WITH (FORCE)");
            System.out.println("[LIVE API] Test server stopped and isolated database removed");
        }
    }

    private void clinicalWorkflow(JdbcTemplate db, String admin, UUID a, UUID b, JsonNode patientA, JsonNode patientB) throws Exception {
        JsonNode visitA = call("Create visit A", "POST", "/api/v1/visits", admin, a.toString(),
                Map.of("patientId", patientA.path("id").asText(), "facilityId", a, "visitType", "NEW", "serviceStream", "GENERAL"), 201).path("visit");
        JsonNode visitB = call("Create visit B", "POST", "/api/v1/visits", admin, b.toString(),
                Map.of("patientId", patientB.path("id").asText(), "facilityId", b, "visitType", "NEW", "serviceStream", "GENERAL"), 201).path("visit");
        String captureA = "/api/v1/visits/" + visitA.path("id").asText() + "/triage-assessments";
        Map<String, Object> vitals = new java.util.HashMap<>(Map.of("systolicBloodPressure", 120, "diastolicBloodPressure", 80,
                "heartRate", 75, "temperatureCelsius", "37.0", "respiratoryRate", 16, "avpu", "ALERT", "confirmOutOfRange", false));
        JsonNode first = call("Capture triage A", "POST", captureA, admin, a.toString(), vitals, 201).path("assessment");
        vitals.put("systolicBloodPressure", 190);
        call("Abnormal vitals need confirmation", "POST", captureA, admin, a.toString(), vitals, 422);
        vitals.put("confirmOutOfRange", true);
        JsonNode second = call("Confirmed triage A", "POST", captureA, admin, a.toString(), vitals, 201).path("assessment");
        JsonNode detail = call("Reload triage detail and prior", "GET", "/api/v1/triage-assessments/" + second.path("id").asText(), admin, a.toString(), null, 200);
        assertThat(detail.path("priorAssessment").path("id")).isEqualTo(first.path("id"));
        call("Triage B", "POST", "/api/v1/visits/" + visitB.path("id").asText() + "/triage-assessments", admin, b.toString(), vitals, 201);
        JsonNode list = call("Clinic-scoped triage history", "GET", "/api/v1/triage-assessments", admin, a.toString(), null, 200);
        assertThat(list.path("items").size()).isEqualTo(2);
        call("Cross-clinic triage detail denied", "GET", "/api/v1/triage-assessments/" + first.path("id").asText(), admin, b.toString(), null, 404);
        call("Cross-clinic triage capture denied", "POST", captureA, admin, b.toString(), vitals, 404);
        Map<String, Object> prescription = Map.of("visitId", visitA.path("id").asText(), "items", List.of(Map.of("drugName", "Test medicine", "dosage", "Test directions", "quantity", 2)));
        call("Unlicensed prescribing denied", "POST", "/api/v1/prescriptions", admin, a.toString(), prescription, 403);
        db.update("update live_a.users set hpcsa_number = 'TEST-HPCSA', hpcsa_expiry_date = current_date + 365, sapc_number = 'TEST-SAPC', sapc_expiry_date = current_date + 365 where email = 'admin@live.example'");
        JsonNode rx = call("Create prescription", "POST", "/api/v1/prescriptions", admin, a.toString(), prescription, 201);
        String rxPath = "/api/v1/prescriptions/" + rx.path("id").asText();
        assertThat(call("Pharmacy queue", "GET", "/api/v1/prescriptions/queue?facilityId=" + a, admin, a.toString(), null, 200).path("items").size()).isEqualTo(1);
        call("Cross-clinic prescription denied", "GET", rxPath, admin, b.toString(), null, 404);
        call("Dispense prescription", "POST", rxPath + "/dispense", admin, a.toString(), null, 204);
        assertThat(call("Dispensed detail", "GET", rxPath, admin, a.toString(), null, 200).path("status").asText()).isEqualTo("DISPENSED");
        call("Duplicate dispensing denied", "POST", rxPath + "/dispense", admin, a.toString(), null, 409);
        assertThat(call("Queue cleared after dispensing", "GET", "/api/v1/prescriptions/queue?facilityId=" + a, admin, a.toString(), null, 200).path("items").size()).isZero();
        assertThat(call("Dispensing dashboard count", "GET", "/api/v1/prescriptions/stats?facilityId=" + a, admin, a.toString(), null, 200).path("dispensedToday").asInt()).isEqualTo(1);
    }

    private String login(String name) throws Exception {
        return call("Login " + name, "POST", "/api/v1/auth/login", null, null,
                Map.of("email", name + "@live.example", "password", password), 200).path("accessToken").asText();
    }

    private JsonNode call(String name, String method, String path, String token, String clinic, Object body, int expected) throws Exception {
        var request = HttpRequest.newBuilder(URI.create(baseUrl + path)).timeout(Duration.ofSeconds(30))
                .header("X-Tenant-ID", "smoke-a").header("Content-Type", "application/json");
        if (token != null) { request.header("Authorization", "Bearer " + token); }
        if (clinic != null) { request.header("X-Clinic-ID", clinic); }
        request.method(method, body == null ? HttpRequest.BodyPublishers.noBody() : HttpRequest.BodyPublishers.ofString(json.writeValueAsString(body)));
        var response = http.send(request.build(), HttpResponse.BodyHandlers.ofString());
        assertThat(response.statusCode()).as(name + " HTTP status").isEqualTo(expected);
        System.out.println("[LIVE API] " + name + " => " + response.statusCode());
        return response.body().isBlank() ? json.createObjectNode() : json.readTree(response.body());
    }

    private void assertOnlyPatient(JsonNode response, JsonNode patient) {
        assertThat(response.path("items").size()).isEqualTo(1);
        assertThat(response.path("items").get(0).path("id")).isEqualTo(patient.path("id"));
    }

    private UUID clinic(JdbcTemplate db, String code) {
        UUID id = UUID.randomUUID();
        db.update("insert into live_a.facilities (id, name, code, type) values (?, ?, ?, 'CLINIC')", id, "Clinic " + code, code);
        return id;
    }

    private UUID user(JdbcTemplate db, String name, String hash, UUID clinic, String role) {
        UUID id = UUID.randomUUID();
        db.update("insert into live_a.users (id, employee_number, email, first_name, last_name, contact_number, password_hash, facility_id) "
                + "values (?, ?, ?, 'Live', 'Tester', ?, ?, ?)", id, name, name + "@live.example", name, hash, clinic);
        db.update("insert into live_a.user_roles (user_id, role_id, facility_id) select ?, id, ? from live_a.roles where name = ?", id, clinic, role);
        if (clinic != null) { db.update("insert into live_a.user_facilities values (?, ?)", id, clinic); }
        return id;
    }

    private Map<String, String> patient(String prefix) {
        int sum = 0;
        for (int i = 0; i < prefix.length(); i++) {
            int digit = prefix.charAt(i) - '0';
            if (i % 2 == 1) { digit *= 2; }
            sum += digit / 10 + digit % 10;
        }
        return Map.of("firstName", "Live", "lastName", "ClinicSmoke", "idNumber", prefix + ((10 - sum % 10) % 10),
                "address", "Test address", "contactNumber", "+27821234567");
    }
}
