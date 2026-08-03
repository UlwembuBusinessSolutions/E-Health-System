package co.ehealth.platform.platform;

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

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    protected PlatformAuditLog() {
    }

    public PlatformAuditLog(UUID platformOperatorId, String action, UUID organizationId, Instant createdAt) {
        this.platformOperatorId = platformOperatorId;
        this.action = action;
        this.organizationId = organizationId;
        this.createdAt = createdAt;
    }
}
