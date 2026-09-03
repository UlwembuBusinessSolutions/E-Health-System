package co.ehealth.platform.core.tenant;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

// Explicit @Order, not left to registration order: other ApplicationRunner
// beans (platform.PlatformOperatorBootstrap, dev-only) query tables this
// migration creates — Spring Boot doesn't otherwise guarantee runner order
// across beans, and running those before the control schema exists fails
// with "relation does not exist" at startup.
//
// Also the fix for a real gap this class didn't used to cover: before this,
// TenantMigrationRunner.provisionTenantSchema() only ever ran once per
// tenant, at the moment OrganizationProvisioningService created it — an
// organization provisioned last month never picked up a tenant-schema
// migration file added to the codebase this month, because nothing ever
// called .migrate() against its schema again. Found by adding V8__patients.sql
// and hitting "relation patients does not exist" against an
// already-provisioned tenant. Flyway's own migrate() is a safe no-op
// against a schema that's already current, so re-running it here for every
// existing organization on every startup costs nothing once a tenant has
// caught up, and doesn't risk re-applying anything.
@Component
@Order(0)
class StartupMigrations implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(StartupMigrations.class);

    private final TenantMigrationRunner migrationRunner;
    private final OrganizationRepository organizationRepository;

    StartupMigrations(TenantMigrationRunner migrationRunner, OrganizationRepository organizationRepository) {
        this.migrationRunner = migrationRunner;
        this.organizationRepository = organizationRepository;
    }

    @Override
    public void run(ApplicationArguments args) {
        migrationRunner.migrateControlSchema();

        for (Organization organization : organizationRepository.findAll()) {
            log.info("Applying any pending tenant-schema migrations for '{}'", organization.getSlug());
            migrationRunner.provisionTenantSchema(organization.getSchemaName());
        }
    }
}
