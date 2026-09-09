package co.ehealth.platform.core.clinic;

import co.ehealth.platform.core.audit.AuditLogRepository;
import co.ehealth.platform.core.audit.AuditLogService;
import co.ehealth.platform.facility.FacilityRepository;
import co.ehealth.platform.identity.UserRepository;
import co.ehealth.platform.patient.Patient;
import co.ehealth.platform.patient.PatientRepository;
import co.ehealth.platform.pharmacy.ManualVerificationCaseRepository;
import co.ehealth.platform.pharmacy.PrescriptionRepository;
import co.ehealth.platform.triage.TriageAssessmentRepository;
import co.ehealth.platform.visit.VisitRepository;
import jakarta.persistence.EntityManager;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.beans.factory.config.YamlPropertiesFactoryBean;
import org.springframework.core.env.StandardEnvironment;
import org.springframework.core.io.ClassPathResource;
import org.springframework.data.jpa.repository.support.JpaRepositoryFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.orm.jpa.LocalContainerEntityManagerFactoryBean;
import org.springframework.orm.jpa.vendor.HibernateJpaVendorAdapter;
import java.time.Clock;
import java.util.List;
import java.util.Map;
import java.util.Properties;
import java.util.UUID;
import static org.assertj.core.api.Assertions.assertThat;

// Opt-in: uses the configured PostgreSQL server, but creates and drops only a uniquely named test schema.
@EnabledIfSystemProperty(named = "clinic.postgres.tests", matches = "true")
class ClinicScopePostgresTest {
    @Test
    void migrationsAndRealRepositoryQueriesIsolateClinics() {
        DriverManagerDataSource source = datasource();
        String schema = "clinic_test_" + UUID.randomUUID().toString().replace("-", "");
        JdbcTemplate admin = new JdbcTemplate(source);
        admin.execute("CREATE SCHEMA " + schema);
        LocalContainerEntityManagerFactoryBean factory = null;
        EntityManager entityManager = null;
        try {
            Properties properties = new Properties();
            properties.setProperty("currentSchema", schema);
            source.setConnectionProperties(properties);
            Flyway.configure().dataSource(source).schemas(schema).defaultSchema(schema)
                    .locations("classpath:db/migration/tenant").target("22").load().migrate();
            JdbcTemplate jdbc = new JdbcTemplate(source);
            UUID a = clinic(jdbc, "A");
            UUID b = clinic(jdbc, "B");
            UUID user = UUID.randomUUID();
            jdbc.update("insert into users (id, employee_number, email, first_name, last_name, contact_number, "
                    + "password_hash, facility_id) values (?, 'TEST', 'test@example.test', 'Test', 'User', '123', 'hash', ?)", user, a);
            jdbc.update("insert into user_facilities values (?, ?)", user, a);
            jdbc.update("insert into user_facilities values (?, ?)", user, b);
            UUID role = jdbc.queryForObject("select id from roles where name = 'ORG_ADMIN'", UUID.class);
            jdbc.update("insert into user_roles (user_id, role_id, facility_id) values (?, ?, ?)", user, role, a);
            UUID pa = patient(jdbc, user, "MPI-0000001", "8501011002085");
            UUID pb = patient(jdbc, user, "MPI-0000002", "8501011002086");
            UUID unknown = patient(jdbc, null, "MPI-0000003", "8501011002087");
            UUID ambiguous = patient(jdbc, user, "MPI-0000004", "8501011002088");
            UUID vb = visit(jdbc, pb, b);
            visit(jdbc, ambiguous, a);
            visit(jdbc, ambiguous, b);
            Flyway.configure().dataSource(source).schemas(schema).defaultSchema(schema)
                    .locations("classpath:db/migration/tenant").load().migrate();
            assertThat(jdbc.queryForObject("select facility_id from patients where id = ?", UUID.class, pa)).isEqualTo(a);
            assertThat(jdbc.queryForObject("select facility_id from patients where id = ?", UUID.class, pb)).isEqualTo(b);
            assertThat(jdbc.queryForObject("select facility_id from patients where id = ?", UUID.class, unknown)).isNull();
            assertThat(jdbc.queryForObject("select facility_id from patients where id = ?", UUID.class, ambiguous)).isNull();
            assertThat(jdbc.queryForObject("select count(*) from user_roles where user_id = ? and facility_id = ?",
                    Integer.class, user, b)).isEqualTo(1);
            jdbc.update("delete from user_facilities where user_id = ? and facility_id = ?", user, b);
            jdbc.update("delete from user_roles where user_id = ? and facility_id = ?", user, b);
            UUID va = visit(jdbc, pa, a);

            factory = new LocalContainerEntityManagerFactoryBean();
            factory.setDataSource(source);
            factory.setPackagesToScan("co.ehealth.platform.patient", "co.ehealth.platform.identity",
                    "co.ehealth.platform.facility", "co.ehealth.platform.visit", "co.ehealth.platform.pharmacy",
                    "co.ehealth.platform.triage", "co.ehealth.platform.core.audit");
            factory.setJpaVendorAdapter(new HibernateJpaVendorAdapter());
            factory.setJpaPropertyMap(Map.of("hibernate.hbm2ddl.auto", "validate", "hibernate.default_schema", schema));
            factory.afterPropertiesSet();
            entityManager = factory.getObject().createEntityManager();
            JpaRepositoryFactory repositories = new JpaRepositoryFactory(entityManager);
            PatientRepository patients = repositories.getRepository(PatientRepository.class);
            UserRepository users = repositories.getRepository(UserRepository.class);
            FacilityRepository facilities = repositories.getRepository(FacilityRepository.class);
            VisitRepository visits = repositories.getRepository(VisitRepository.class);
            assertThat(patients.search("Smith", a)).extracting(Patient::getId).containsExactly(pa);
            assertThat(patients.search("Smith", b)).extracting(Patient::getId).containsExactly(pb);
            assertThat(patients.search("MPI-0000002", a)).isEmpty();
            assertThat(patients.search("8501011002086", a)).isEmpty();
            assertThat(patients.findByIdAndFacilityId(pb, a)).isEmpty();
            assertThat(visits.findByIdAndFacilityId(vb, a)).isEmpty();
            assertThat(visits.findByFacilityIdOrderByVisitDateTimeDesc(a)).extracting("id").contains(va).doesNotContain(vb);
            assertThat(users.findAccessibleClinicIds(user)).containsExactly(a);
            assertThat(users.findRoleNamesInClinic(user, a)).containsExactly("ORG_ADMIN");
            assertThat(users.findRoleNamesInClinic(user, b)).isEmpty();
            assertThat(users.findRoleNamesInClinic(user, null)).isEmpty();
            assertThat(facilities.findAccessible(user)).extracting("id").containsExactly(a);

            jdbc.update("insert into user_facilities values (?, ?)", user, b);
            assertThat(users.findAccessibleClinicIds(user)).containsExactly(a, b);
            jdbc.update("insert into user_roles (user_id, role_id, facility_id) values (?, ?, ?)", user, role, b);
            assertThat(users.findRoleNames(user)).containsExactly("ORG_ADMIN");
            assertThat(users.findByRoleName("ORG_ADMIN")).extracting("id").containsExactly(user);
            jdbc.update("delete from user_facilities where user_id = ? and facility_id = ?", user, a);
            assertThat(users.findAccessibleClinicIds(user)).containsExactly(b);
            jdbc.update("update facilities set active = false where id = ?", b);
            assertThat(users.findAccessibleClinicIds(user)).isEmpty();

            // Exercise native and JPQL query parsing for the related patient-data paths too.
            assertThat(repositories.getRepository(PrescriptionRepository.class)
                    .findByFacilityIdOrderByCreatedAtDesc(a)).isEmpty();
            assertThat(repositories.getRepository(ManualVerificationCaseRepository.class).findInClinic(a)).isEmpty();
            assertThat(repositories.getRepository(TriageAssessmentRepository.class).findLatestInClinic(pa, a)).isEmpty();
            AuditLogRepository auditRows = repositories.getRepository(AuditLogRepository.class);
            entityManager.getTransaction().begin();
            ClinicContext.set(a);
            new AuditLogService(auditRows, Clock.systemUTC()).append(user, b, "TEST", "Facility", b.toString(), null, null);
            entityManager.getTransaction().commit();
            entityManager.clear();
            assertThat(auditRows.findByClinicContextIdOrderByCreatedAtDesc(a)).singleElement()
                    .satisfies(row -> {
                        assertThat(row.getClinicContextId()).isEqualTo(a);
                        assertThat(row.getFacilityId()).isEqualTo(b);
                    });
        } finally {
            ClinicContext.clear();
            if (entityManager != null) {
                if (entityManager.getTransaction().isActive()) { entityManager.getTransaction().rollback(); }
                entityManager.close();
            }
            if (factory != null) { factory.destroy(); }
            admin.execute("DROP SCHEMA " + schema + " CASCADE");
        }
    }

    private DriverManagerDataSource datasource() {
        YamlPropertiesFactoryBean yaml = new YamlPropertiesFactoryBean();
        yaml.setResources(new ClassPathResource("application.yml"));
        Properties properties = yaml.getObject();
        var environment = new StandardEnvironment();
        return new DriverManagerDataSource(
                environment.resolveRequiredPlaceholders(properties.getProperty("spring.datasource.url")),
                environment.resolveRequiredPlaceholders(properties.getProperty("spring.datasource.username")),
                environment.resolveRequiredPlaceholders(properties.getProperty("spring.datasource.password")));
    }

    private UUID clinic(JdbcTemplate jdbc, String code) {
        UUID id = UUID.randomUUID();
        jdbc.update("insert into facilities (id, name, code, type) values (?, ?, ?, 'CLINIC')", id, code, code);
        return id;
    }

    private UUID patient(JdbcTemplate jdbc, UUID registeredBy, String mpi, String idNumber) {
        UUID id = UUID.randomUUID();
        jdbc.update("insert into patients (id, registered_by_user_id, mpi_number, first_name, last_name, date_of_birth, gender, "
                + "citizenship_status, id_number, address, contact_number) "
                + "values (?, ?, ?, 'Alex', 'Smith', '1985-01-01', 'FEMALE', 'SA_CITIZEN', ?, 'Road', '123')",
                id, registeredBy, mpi, idNumber);
        return id;
    }

    private UUID visit(JdbcTemplate jdbc, UUID patient, UUID clinic) {
        UUID id = UUID.randomUUID();
        jdbc.update("insert into visits (id, patient_id, facility_id, visit_type, service_stream, visit_datetime) "
                + "values (?, ?, ?, 'NEW', 'GENERAL', now())", id, patient, clinic);
        return id;
    }
}
