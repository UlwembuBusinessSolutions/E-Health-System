package co.ehealth.platform.core.tenant;

import org.flywaydb.core.Flyway;
import org.springframework.stereotype.Component;

import javax.sql.DataSource;

@Component
public class TenantMigrationRunner {

    private final DataSource dataSource;

    public TenantMigrationRunner(DataSource dataSource) {
        this.dataSource = dataSource;
    }

    public void migrateControlSchema() {
        Flyway.configure().dataSource(dataSource).schemas("control")
                .locations("classpath:db/migration/control").load().migrate();
    }

    public void provisionTenantSchema(String schemaName) {
        Flyway.configure().dataSource(dataSource).schemas(schemaName)
                .locations("classpath:db/migration/tenant").load().migrate();
    }
}
