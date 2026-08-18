package co.ehealth.platform.core.tenant;

import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

// Explicit @Order, not left to registration order: other ApplicationRunner
// beans (platform.PlatformOperatorBootstrap, dev-only) query tables this
// migration creates — Spring Boot doesn't otherwise guarantee runner order
// across beans, and running those before the control schema exists fails
// with "relation does not exist" at startup.
@Component
@Order(0)
class StartupMigrations implements ApplicationRunner {

    private final TenantMigrationRunner migrationRunner;
    private final ModuleEntitlementCache entitlementCache;

    StartupMigrations(TenantMigrationRunner migrationRunner, ModuleEntitlementCache entitlementCache) {
        this.migrationRunner = migrationRunner;
        this.entitlementCache = entitlementCache;
    }

    @Override
    public void run(ApplicationArguments args) {
        migrationRunner.migrateControlSchema();
        entitlementCache.refresh();
    }
}
