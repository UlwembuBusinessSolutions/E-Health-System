package co.ehealth.platform.core.tenant;

import org.flywaydb.core.Flyway;
import org.flywaydb.core.api.FlywayException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import javax.sql.DataSource;

@Component
public class TenantMigrationRunner {

    private static final Logger log = LoggerFactory.getLogger(TenantMigrationRunner.class);

    private final DataSource dataSource;

    public TenantMigrationRunner(DataSource dataSource) {
        this.dataSource = dataSource;
    }

    public void migrateControlSchema() {
        Flyway.configure().dataSource(dataSource).schemas("control")
                .locations("classpath:db/migration/control").load().migrate();
    }

    public void provisionTenantSchema(String schemaName) {
        try {
            Flyway.configure().dataSource(dataSource).schemas(schemaName)
                    .locations("classpath:db/migration/tenant").load().migrate();
        } catch (FlywayException ex) {
            if (isOwnershipMismatch(ex)) {
                log.warn("Skipping tenant schema migration for '{}' because the active database user does not own existing objects in that schema. This is usually a stale local dev schema; startup continues without re-running the migration.", schemaName, ex);
                return;
            }
            throw ex;
        }
    }

    static boolean isOwnershipMismatch(Throwable throwable) {
        Throwable current = throwable;
        while (current != null) {
            String message = current.getMessage();
            if (message != null && (message.contains("must be owner of table") || message.contains("must be owner of schema"))) {
                return true;
            }
            current = current.getCause();
        }
        return false;
    }
}
