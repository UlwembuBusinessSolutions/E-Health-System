package co.ehealth.platform.core.tenant;

import org.hibernate.HibernateException;
import org.hibernate.engine.jdbc.connections.spi.MultiTenantConnectionProvider;
import org.springframework.stereotype.Component;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.regex.Pattern;

@Component
public class TenantConnectionProvider implements MultiTenantConnectionProvider<String> {

    // schema_name is platform-generated (see organization provisioning),
    // never taken verbatim from user input — this pattern is a second line
    // of defense, not the only one. SET search_path can't be parameterized
    // like a normal bind variable, so an unvalidated value here is a SQL
    // injection path, not just a correctness bug.
    private static final Pattern SAFE_SCHEMA = Pattern.compile("^[a-z][a-z0-9_]{2,62}$");

    private final DataSource dataSource;

    public TenantConnectionProvider(DataSource dataSource) {
        this.dataSource = dataSource;
    }

    @Override
    public Connection getAnyConnection() throws SQLException {
        return dataSource.getConnection();
    }

    @Override
    public void releaseAnyConnection(Connection connection) throws SQLException {
        connection.close();
    }

    @Override
    public Connection getConnection(String tenantIdentifier) throws SQLException {
        Connection connection = getAnyConnection();
        applySchema(connection, requireSafe(tenantIdentifier));
        return connection;
    }

    @Override
    public void releaseConnection(String tenantIdentifier, Connection connection) throws SQLException {
        try {
            applySchema(connection, "public"); // reset before the connection returns to the pool
        } finally {
            connection.close();
        }
    }

    private void applySchema(Connection connection, String schema) throws SQLException {
        try (Statement statement = connection.createStatement()) {
            statement.execute("SET search_path TO " + schema);
        } catch (SQLException e) {
            throw new HibernateException("Could not set search_path to [" + schema + "]", e);
        }
    }

    private String requireSafe(String tenantIdentifier) {
        if (!SAFE_SCHEMA.matcher(tenantIdentifier).matches()) {
            throw new IllegalArgumentException("Refusing unsafe schema identifier: " + tenantIdentifier);
        }
        return tenantIdentifier;
    }

    @Override
    public boolean supportsAggressiveRelease() {
        return false;
    }

    @Override
    public boolean isUnwrappableAs(Class<?> unwrapType) {
        return false;
    }

    @Override
    public <T> T unwrap(Class<T> unwrapType) {
        return null;
    }
}
