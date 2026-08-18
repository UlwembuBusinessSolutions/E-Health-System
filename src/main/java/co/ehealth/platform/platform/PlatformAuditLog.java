package co.ehealth.platform.platform;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;
import co.ehealth.platform.core.tenant.ModuleCode;

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

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Enumerated(jakarta.persistence.EnumType.STRING)
    @Column(name = "module_code", length = 20)
    private ModuleCode moduleCode;

    @Column(name = "previous_enabled")
    private Boolean previousEnabled;

    @Column(name = "new_enabled")
    private Boolean newEnabled;

    protected PlatformAuditLog() {
    }

    public PlatformAuditLog(UUID platformOperatorId, String action, UUID organizationId, Instant createdAt) {
        this.platformOperatorId = platformOperatorId;
        this.action = action;
        this.organizationId = organizationId;
        this.createdAt = createdAt;
    }

    public PlatformAuditLog(UUID platformOperatorId, String action, UUID organizationId, ModuleCode moduleCode,
                            boolean previousEnabled, boolean newEnabled, Instant createdAt) {
        this(platformOperatorId, action, organizationId, createdAt);
        this.moduleCode = moduleCode;
        this.previousEnabled = previousEnabled;
        this.newEnabled = newEnabled;
    }
}
