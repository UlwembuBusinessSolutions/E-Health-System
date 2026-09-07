package co.ehealth.platform.platform;

import co.ehealth.platform.core.common.RequestMetadata;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

// The seller-side audit trail — separate from each tenant's own audit_log
// rather than trying to attribute a platform operator's actions there: a
// platform operator isn't a row in any tenant's users table.
@Entity
@Table(name = "platform_audit_log", schema = "control")
public class PlatformAuditLog {

    @Id
    @GeneratedValue
    private UUID id;

    @Column(name = "platform_operator_id", nullable = false)
    private UUID platformOperatorId;

    @Column(nullable = false, length = 100)
    private String action;

    @Column(name = "organization_id")
    private UUID organizationId;

    // Nullable — most actions (ORGANIZATION_SUSPENDED, PLATFORM_OPERATOR_CREATED,
    // ...) say everything they need to in the action code alone. Added for
    // MODULE_TOGGLED, whose own acceptance criteria requires capturing which
    // module and its previous/new state, not just that a toggle happened.
    @Column(length = 500)
    private String detail;

    @Column(name = "ip_address", length = 45)
    private String ipAddress;

    @Column(name = "device_signature", length = 500)
    private String deviceSignature;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    protected PlatformAuditLog() {
    }

    public PlatformAuditLog(UUID platformOperatorId, String action, UUID organizationId, Instant createdAt) {
        this(platformOperatorId, action, organizationId, null, createdAt);
    }

    // No dedicated PlatformAuditService.append() choke point the way the
    // tenant-side AuditLog has — every call site across
    // PlatformOperatorService/OrganizationProvisioningService/
    // PlatformAuthService constructs this entity directly. Reading
    // RequestMetadata here instead of accepting ipAddress/deviceSignature as
    // constructor params means this constructor IS the choke point: every
    // one of those 8 call sites gets both captured for free, the same
    // guarantee AuditLogService.append() gives the tenant side.
    public PlatformAuditLog(UUID platformOperatorId, String action, UUID organizationId, String detail,
                             Instant createdAt) {
        this.platformOperatorId = platformOperatorId;
        this.action = action;
        this.organizationId = organizationId;
        this.detail = detail;
        this.ipAddress = RequestMetadata.currentIpAddress();
        this.deviceSignature = RequestMetadata.currentUserAgent();
        this.createdAt = createdAt;
    }

    public UUID getId() {
        return id;
    }

    public UUID getPlatformOperatorId() {
        return platformOperatorId;
    }

    public String getAction() {
        return action;
    }

    public UUID getOrganizationId() {
        return organizationId;
    }

    public String getDetail() {
        return detail;
    }

    public String getIpAddress() {
        return ipAddress;
    }

    public String getDeviceSignature() {
        return deviceSignature;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
