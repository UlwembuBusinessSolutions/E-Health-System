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

    // Added the field for sector type to the organization entity
    @Enumerated(EnumType.STRING)
    @Column(name = "sector_type", nullable = false, length = 20)
    private SectorType sectorType;

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
    public Organization(String slug, String schemaName, String displayName, SectorType sectorType) {
        this.slug = slug;
        this.schemaName = schemaName;
        this.displayName = displayName;
        this.status = OrganizationStatus.ACTIVE;
        this.sectorType = sectorType != null ? sectorType : SectorType.PRIVATE;
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

    // This method is used to get the sector type of the organization
    public SectorType getSectorType() {
        return sectorType;
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
