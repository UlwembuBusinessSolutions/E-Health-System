package co.ehealth.platform.platform;

import co.ehealth.platform.core.tenant.ModuleEntitlementRepository;
import co.ehealth.platform.core.tenant.Organization;
import co.ehealth.platform.core.tenant.OrganizationRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowCallbackHandler;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.regex.Pattern;

/** Read model for the platform-wide tenant register (SADM-US-005). */
@Service
public class TenantRegisterService {

    private static final int FOUNDATION_MODULE_COUNT = 3;
    private static final Pattern SAFE_SCHEMA = Pattern.compile("^[a-z][a-z0-9_]{2,62}$");

    private final OrganizationRepository organizationRepository;
    private final ModuleEntitlementRepository moduleEntitlementRepository;
    private final JdbcTemplate jdbcTemplate;

    public TenantRegisterService(OrganizationRepository organizationRepository,
                                 ModuleEntitlementRepository moduleEntitlementRepository,
                                 JdbcTemplate jdbcTemplate) {
        this.organizationRepository = organizationRepository;
        this.moduleEntitlementRepository = moduleEntitlementRepository;
        this.jdbcTemplate = jdbcTemplate;
    }

    public Page<Organization> findTenants(String name, Pageable pageable) {
        Specification<Organization> specification = Specification.where(null);
        if (name != null && !name.isBlank()) {
            String pattern = "%" + name.trim().toLowerCase() + "%";
            specification = specification.and((root, query, builder) -> builder.or(
                    builder.like(builder.lower(root.get("displayName")), pattern),
                    builder.like(builder.lower(root.get("slug")), pattern)));
        }
        return organizationRepository.findAll(specification, pageable);
    }

    /** One grouped control-schema query, with Foundation modules always enabled. */
    public Map<UUID, Integer> activeModuleCounts(List<UUID> organizationIds) {
        Map<UUID, Integer> counts = new HashMap<>();
        organizationIds.forEach(id -> counts.put(id, FOUNDATION_MODULE_COUNT));
        if (organizationIds.isEmpty()) return counts;
        for (Object[] row : moduleEntitlementRepository.countEnabledByOrganizationIdIn(organizationIds)) {
            counts.put((UUID) row[0], FOUNDATION_MODULE_COUNT + ((Long) row[1]).intValue());
        }
        return counts;
    }

    /**
     * Facilities reside in separate tenant schemas. A UNION ALL gives the
     * current page's per-tenant totals in one database round trip, rather
     * than switching tenant context and issuing one count per row.
     */
    public Map<UUID, Integer> clinicCounts(List<Organization> organizations) {
        Map<UUID, Integer> counts = new HashMap<>();
        organizations.forEach(org -> counts.put(org.getId(), 0));
        if (organizations.isEmpty()) return counts;

        String sql = organizations.stream().map(org -> {
            String schema = org.getSchemaName();
            if (!SAFE_SCHEMA.matcher(schema).matches()) {
                throw new IllegalStateException("Organization has an unsafe schema name");
            }
            return "SELECT '" + org.getId() + "'::uuid AS organization_id, COUNT(*) AS clinic_count "
                    + "FROM \"" + schema + "\".facilities";
        }).reduce((left, right) -> left + " UNION ALL " + right).orElseThrow();

        jdbcTemplate.query(sql, (RowCallbackHandler) resultSet -> counts.put(
                UUID.fromString(resultSet.getString("organization_id")), resultSet.getInt("clinic_count")));
        return counts;
    }
}
