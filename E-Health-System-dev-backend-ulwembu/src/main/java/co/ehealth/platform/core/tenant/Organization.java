package co.ehealth.platform.core.tenant;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "organizations", schema = "control") // always fully qualified — bypasses search_path entirely
public class Organization {

    @Id
    @GeneratedValue
    private UUID id;

    @Column(nullable = false, unique = true, length = 63)
    private String slug;

    @Column(name = "schema_name", nullable = false, unique = true, length = 63)
    private String schemaName;

    @Column(name = "display_name", nullable = false, length = 200)
    private String displayName;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private OrganizationStatus status;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private OrganizationSector sector;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    // Real column, previously unmapped entirely — see OrganizationBranding's
    // own comment. columnDefinition = "jsonb" matches control.organizations'
    // real column type exactly; Hibernate 6's JSON support serializes this
    // record through Jackson (already on the classpath) with no extra config.
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb", nullable = false)
    private OrganizationBranding branding = OrganizationBranding.empty();

    protected Organization() {
    }

    // ACTIVE and createdAt are set here, not taken as constructor
    // parameters — every organization starts ACTIVE at the moment it's
    // provisioned; there's no real scenario for creating one pre-suspended.
    // sector IS a constructor parameter, unlike status — it has no fixed
    // starting value the way status always starts ACTIVE, so the caller has
    // to supply one (PlatformController's @NotNull is what actually
    // enforces that nobody can omit it).
    public Organization(String slug, String schemaName, String displayName, OrganizationSector sector) {
        this.slug = slug;
        this.schemaName = schemaName;
        this.displayName = displayName;
        this.sector = sector;
        this.status = OrganizationStatus.ACTIVE;
        this.createdAt = Instant.now();
    }

    // This pair is the entire "license" switch: TenantFilter resolves
    // tenants through findActiveBySlug(), which only matches ACTIVE rows.
    // Calling suspend() doesn't delete anything or touch the tenant's own
    // schema — it just makes every request against that tenant 404 as an
    // unknown tenant until someone calls reactivate().
    public void suspend() {
        this.status = OrganizationStatus.SUSPENDED;
    }

    public void reactivate() {
        this.status = OrganizationStatus.ACTIVE;
    }

    // slug/schemaName are deliberately not settable anywhere in this class
    // — schemaName is the literal Postgres schema this tenant's data lives
    // in, and slug is what every login URL (/org/:tenantSlug/login) and
    // X-Tenant-ID header value is built from. Renaming either is a real
    // migration (rename the schema, or accept every existing bookmark/
    // stored header breaking), not a field update; out of scope here.
    public void rename(String displayName) {
        this.displayName = displayName;
    }

    // SADM-US-002's own acceptance criteria: changing sector preserves
    // existing module entitlements rather than reapplying sector defaults
    // — this method only ever touches the sector field, on purpose,
    // exactly so callers can't accidentally couple the two.
    public void changeSector(OrganizationSector sector) {
        this.sector = sector;
    }

    public UUID getId() {
        return id;
    }

    public String getSlug() {
        return slug;
    }

    public String getSchemaName() {
        return schemaName;
    }

    public String getDisplayName() {
        return displayName;
    }

    public OrganizationStatus getStatus() {
        return status;
    }

    public OrganizationSector getSector() {
        return sector;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public OrganizationBranding getBranding() {
        return branding;
    }

    public void setBranding(OrganizationBranding branding) {
        this.branding = branding;
    }
}
