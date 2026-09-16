package co.ehealth.platform.visit;

// RECQ-US-005: real HTTP acceptance checks with an isolated PostgreSQL database.

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
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

// Real TCP requests through Tomcat, tenant routing, JWT authentication and database-backed services.
@EnabledIfSystemProperty(named = "queue.live.tests", matches = "true")
class QueueLifecycleLiveApiTest {
    private final ObjectMapper json = new ObjectMapper();
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();
    private final String password = "LiveTest-" + UUID.randomUUID();
    private String baseUrl;

    @Test
    void liveQueueLifecycleAsProfessionalNurse() throws Exception {
        String url = System.getProperty("queue.db.url", "jdbc:postgresql://localhost:5432/ulwembu");
        String username = System.getProperty("queue.db.username", "ulwembu");
        String secret = System.getProperty("queue.db.password", "ulwembu_dev_local");
        String database = "live_queue_test_" + UUID.randomUUID().toString().replace("-", "");
        String testUrl = url.substring(0, url.lastIndexOf('/') + 1) + database;
        JdbcTemplate adminDb = new JdbcTemplate(new DriverManagerDataSource(url, username, secret));
        adminDb.execute("CREATE DATABASE " + database);
        ServletWebServerApplicationContext app = null;
        try {
            app = (ServletWebServerApplicationContext) new SpringApplicationBuilder(PlatformApplication.class).run(
                    "--spring.config.location=classpath:queue-live-test.properties",
                    "--server.port=0", "--spring.profiles.active=live-api-test",
                    "--logging.level.org.springframework=WARN", "--logging.level.org.hibernate=WARN",
                    "--spring.datasource.url=" + testUrl, "--spring.datasource.username=" + username,
                    "--spring.datasource.password=" + secret,
                    "--app.jwt.secret=" + UUID.randomUUID() + UUID.randomUUID(),
                    "--app.platform.jwt-secret=" + UUID.randomUUID() + UUID.randomUUID());
            baseUrl = "http://localhost:" + app.getWebServer().getPort();
            System.out.println("[LIVE API] Listening at " + baseUrl + " with isolated PostgreSQL database");
            JdbcTemplate db = new JdbcTemplate(new DriverManagerDataSource(testUrl, username, secret));
            app.getBean(TenantMigrationRunner.class).provisionTenantSchema("live_a");
            db.update("insert into control.organizations (slug, schema_name, display_name, sector) values ('smoke-a', 'live_a', 'Queue Live Test', 'PUBLIC')");
            assertThat(db.queryForObject("select count(*) from live_a.flyway_schema_history where version = '24' and success", Integer.class)).isEqualTo(1);
            UUID a = clinic(db, "A"), b = clinic(db, "B");
            String hash = app.getBean(PasswordEncoder.class).encode(password);
            user(db, "admin", hash, null, "ORG_ADMIN");
            UUID nurseId = user(db, "nurse", hash, a, "Professional Nurse");
            user(db, "viewer", hash, a, "Pharmacist");
            String admin = login("admin"), nurse = login("nurse"), viewer = login("viewer");
            JsonNode patient = call("Create synthetic patient", "POST", "/api/v1/patients", admin, a.toString(), patient("850101100208"), 201);
            JsonNode created = call("Nurse creates visit and token", "POST", "/api/v1/visits", nurse, a.toString(),
                    Map.of("patientId", patient.path("id").asText(), "facilityId", a, "visitType", "NEW", "serviceStream", "GENERAL"), 201);
            String visitId = created.path("visit").path("id").asText();
            String id = created.path("token").path("id").asText();
            if (Boolean.getBoolean("queue.browser.hold")) {
                JsonNode priority = issue(nurse, a, visitId, "PRIORITY");
                JsonNode cancellable = issue(nurse, a, visitId, "NORMAL");
                var ready = java.nio.file.Path.of("target", "queue-browser-fixture.json");
                var done = java.nio.file.Path.of("target", "queue-browser.done");
                java.nio.file.Files.deleteIfExists(done);
                try {
                    json.writeValue(ready.toFile(), Map.of("baseUrl", baseUrl, "tenant", "smoke-a",
                            "email", "nurse@live.example", "password", password, "clinicId", a.toString(),
                            "normal", created.path("token"), "priority", priority, "cancellable", cancellable));
                    System.out.println("[LIVE API] Browser fixture ready");
                    long deadline = System.nanoTime() + Duration.ofMinutes(10).toNanos();
                    while (!java.nio.file.Files.exists(done) && System.nanoTime() < deadline) Thread.sleep(1000);
                    assertThat(java.nio.file.Files.exists(done)).as("Browser verification completed before timeout").isTrue();
                    assertThat(java.nio.file.Files.readString(done)).isEqualTo("PASS");
                } finally {
                    java.nio.file.Files.deleteIfExists(ready);
                    java.nio.file.Files.deleteIfExists(done);
                }
                return;
            }
            JsonNode called = call("Call issued token", "POST", "/api/v1/queue/call-next?facilityId=" + a, nurse, a.toString(), null, 200);
            assertThat(called.path("token").path("id").asText()).isEqualTo(id);
            JsonNode complete = transition(nurse, a, id, "COMPLETE", null, 200);
            assertThat(complete.path("completedAt").asText()).isNotBlank().isNotEqualTo("null");
            assertThat(db.queryForObject("select completed_at is not null and status = 'COMPLETED' from live_a.queue_tokens where id = ?", Boolean.class, UUID.fromString(id))).isTrue();
            assertThat(queue(nurse, a, false).size()).isZero();
            assertThat(queue(nurse, a, true).size()).isZero();
            transition(nurse, a, id, "COMPLETE", null, 409);
            transition(nurse, a, id, "RESUME", null, 409);
            transition(nurse, a, id, "CANCEL", "PATIENT_LEFT", 409);

            JsonNode normal = issue(nurse, a, visitId, "NORMAL");
            JsonNode priority = issue(nurse, a, visitId, "PRIORITY");
            String priorityId = priority.path("id").asText();
            // Compare the persisted value: PostgreSQL stores microseconds, while
            // the initial issue response can contain Java clock nanoseconds.
            JsonNode persistedPriority = queue(nurse, a, false).get(0).path("token");
            assertThat(persistedPriority.path("id").asText()).isEqualTo(priorityId);
            transition(nurse, a, priorityId, "COMPLETE", null, 409);
            transition(viewer, a, priorityId, "STOP", null, 403);
            transition(nurse, b, priorityId, "STOP", null, 403);
            transition(admin, b, priorityId, "STOP", null, 409);
            transition(null, a, priorityId, "STOP", null, 403);
            transition(nurse, a, priorityId, "RESUME", null, 409);
            assertThat(call("Priority is called first", "POST", "/api/v1/queue/call-next?facilityId=" + a,
                    nurse, a.toString(), null, 200).path("token").path("id").asText()).isEqualTo(priorityId);
            transition(nurse, a, priorityId, "START_SERVICE", null, 200);
            transition(nurse, a, priorityId, "STOP", null, 200);
            assertThat(queue(nurse, a, false).size()).isEqualTo(1);
            assertThat(queue(nurse, a, true).size()).isEqualTo(2);
            JsonNode newerPriority = issue(nurse, a, visitId, "PRIORITY");
            JsonNode resumed = transition(nurse, a, priorityId, "RESUME", null, 200);
            for (String field : List.of("id", "priority", "issuedAt", "tokenNumber")) {
                assertThat(resumed.path(field)).as("Resume preserves " + field).isEqualTo(persistedPriority.path(field));
            }
            assertThat(queue(nurse, a, false).get(0).path("token").path("id").asText()).isEqualTo(priorityId);
            assertThat(call("Resumed token called at original position", "POST", "/api/v1/queue/call-next?facilityId=" + a,
                    nurse, a.toString(), null, 200).path("token").path("id").asText()).isEqualTo(priorityId);
            transition(nurse, a, priorityId, "START_SERVICE", null, 200);
            transition(nurse, a, priorityId, "COMPLETE", null, 200);
            String cancelId = normal.path("id").asText();
            for (Object invalid : List.of(Map.of("action", "CANCEL"), Map.of("action", "CANCEL", "reasonCode", ""),
                    Map.of("action", "CANCEL", "reasonCode", "UNKNOWN"))) {
                call("Reject missing/invalid cancellation reason", "POST", tokenPath(cancelId), nurse, a.toString(), invalid, 400);
            }
            assertThat(db.queryForObject("select status from live_a.queue_tokens where id = ?", String.class, UUID.fromString(cancelId))).isEqualTo("ISSUED");
            assertThat(db.queryForObject("select count(*) from live_a.audit_log where entity_id = ? and action = 'QUEUE_TOKEN_CANCELLED'", Integer.class, cancelId)).isZero();
            transition(nurse, a, cancelId, "STOP", null, 200);
            transition(nurse, a, cancelId, "CANCEL", "PATIENT_LEFT", 200);
            assertThat(db.queryForObject("select cancelled_at is not null and cancellation_reason = 'PATIENT_LEFT' from live_a.queue_tokens where id = ?", Boolean.class, UUID.fromString(cancelId))).isTrue();
            transition(nurse, a, cancelId, "RESUME", null, 409);
            transition(nurse, a, cancelId, "CANCEL", "PATIENT_LEFT", 409);
            transition(nurse, a, newerPriority.path("id").asText(), "CANCEL", "DUPLICATE_TOKEN", 200);
            for (JsonNode reason : call("Cancellation reason catalogue", "GET", "/api/v1/queue/cancellation-reasons", nurse, a.toString(), null, 200)) {
                JsonNode token = issue(nurse, a, visitId, "NORMAL");
                transition(nurse, a, token.path("id").asText(), "CANCEL", reason.asText(), 200);
            }
            assertThat(queue(nurse, a, true).size()).isZero();
            assertThat(queue(nurse, a, false).size()).isZero();
            call("Empty queue cannot call next", "POST", "/api/v1/queue/call-next?facilityId=" + a, nurse, a.toString(), null, 409);
            JsonNode audit = call("Read persisted audit via API", "GET", "/api/v1/admin/audit", admin, a.toString(), null, 200);
            boolean cancellation = false, resume = false;
            for (JsonNode row : audit.path("items")) {
                if (row.path("entityId").asText().equals(cancelId) && row.path("action").asText().equals("QUEUE_TOKEN_CANCELLED")) {
                    cancellation = true;
                    assertThat(row.path("userId").asText()).isEqualTo(nurseId.toString());
                    assertThat(row.path("clinicContextId").asText()).isEqualTo(a.toString());
                    JsonNode after = row.path("afterValue").isTextual() ? json.readTree(row.path("afterValue").asText()) : row.path("afterValue");
                    assertThat(after.path("reasonCode").asText()).isEqualTo("PATIENT_LEFT");
                }
                if (row.path("entityId").asText().equals(priorityId) && row.path("action").asText().equals("QUEUE_TOKEN_RESUMED")) resume = true;
            }
            assertThat(cancellation).as("Cancellation audit returned through HTTP").isTrue();
            assertThat(resume).as("Resume audit returned through HTTP").isTrue();
            System.out.println("[LIVE API] PASS: completion persistence, reason validation, stop/resume ordering, audit, role and clinic guards");
        } finally {
            if (app != null) app.close();
            adminDb.execute("DROP DATABASE " + database + " WITH (FORCE)");
            System.out.println("[LIVE API] Test server stopped and isolated database removed");
        }
    }

    private String tokenPath(String id) { return "/api/v1/queue/tokens/" + id + "/transition"; }
    private JsonNode transition(String token, UUID clinic, String id, String action, String reason, int expected) throws Exception {
        Map<String, String> body = new java.util.HashMap<>();
        body.put("action", action);
        if (reason != null) body.put("reasonCode", reason);
        return call(action, "POST", tokenPath(id), token, clinic.toString(), body, expected);
    }
    private JsonNode queue(String token, UUID clinic, boolean open) throws Exception {
        return call(open ? "Reload open queue" : "Reload waiting queue", "GET", "/api/v1/queue" + (open ? "/open" : "") + "?facilityId=" + clinic,
                token, clinic.toString(), null, 200).path("items");
    }
    private JsonNode issue(String token, UUID clinic, String visit, String priority) throws Exception {
        return call("Issue " + priority + " test token", "POST", "/api/v1/queue/tokens", token, clinic.toString(),
                Map.of("visitId", visit, "priority", priority), 201);
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
