// package co.ehealth.platform.platform;

// import co.ehealth.platform.core.common.RequestMetadata;
// import jakarta.persistence.Column;
// import jakarta.persistence.Entity;
// import jakarta.persistence.GeneratedValue;
// import jakarta.persistence.Id;
// import jakarta.persistence.Table;

// import java.time.Instant;
// import java.util.UUID;

// @Entity
// @Table(name = "platform_audit_log", schema = "control")
// public class PlatformAuditLog {

//     @Id
//     @GeneratedValue
//     private UUID id;

//     @Column(name = "platform_operator_id", nullable = false)
//     private UUID platformOperatorId;

//     @Column(nullable = false, length = 100)
//     private String action;

//     @Column(name = "organization_id")
//     private UUID organizationId;

//     @Column(length = 500)
//     private String detail;

//     @Column(name = "ip_address", length = 45)
//     private String ipAddress;

//     @Column(name = "device_signature", length = 500)
//     private String deviceSignature;

//     @Column(name = "created_at", nullable = false)
//     private Instant createdAt;

//     protected PlatformAuditLog() {
//     }

//     public PlatformAuditLog(UUID platformOperatorId, String action, UUID organizationId, Instant createdAt) {
//         this(platformOperatorId, action, organizationId, null, createdAt);
//     }

//     public PlatformAuditLog(UUID platformOperatorId, String action, UUID organizationId, String detail,
//                              Instant createdAt) {
//         this.platformOperatorId = platformOperatorId;
//         this.action = action;
//         this.organizationId = organizationId;
//         this.detail = detail;
//         this.ipAddress = RequestMetadata.currentIpAddress();
//         this.deviceSignature = RequestMetadata.currentUserAgent();
//         this.createdAt = createdAt;
//     }

//     public UUID getId() {
//         return id;
//     }

//     public UUID getPlatformOperatorId() {
//         return platformOperatorId;
//     }

//     public String getAction() {
//         return action;
//     }

//     public UUID getOrganizationId() {
//         return organizationId;
//     }

//     public String getDetail() {
//         return detail;
//     }

//     public String getIpAddress() {
//         return ipAddress;
//     }

//     public String getDeviceSignature() {
//         return deviceSignature;
//     }

//     public Instant getCreatedAt() {
//         return createdAt;
//     }
// }

package co.ehealth.platform.platform;

import co.ehealth.platform.core.common.RequestMetadata;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "platform_audit_log", schema = "control")
public class PlatformAuditLog {

    @Id
    @GeneratedValue
    private UUID id;

    @Column(name = "platform_operator_id")
    private UUID platformOperatorId;

    @Column(nullable = false, length = 100)
    private String action;

    @Column(name = "organization_id")
    private UUID organizationId;

    @Column(length = 500)
    private String detail;

    @Column(nullable = false)
    private boolean privileged;

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

    public PlatformAuditLog(UUID platformOperatorId, String action, UUID organizationId, String detail,
            Instant createdAt) {
        this(platformOperatorId, action, organizationId, detail, RequestMetadata.currentIpAddress(),
                RequestMetadata.currentUserAgent(), createdAt);
    }

    public PlatformAuditLog(UUID platformOperatorId, String action, UUID organizationId, String detail,
            String ipAddress, String deviceSignature, Instant createdAt) {
        this.platformOperatorId = platformOperatorId;
        this.action = action;
        this.organizationId = organizationId;
        this.detail = detail;
        this.privileged = platformOperatorId != null;
        this.ipAddress = ipAddress;
        this.deviceSignature = deviceSignature;
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

    public boolean isPrivileged() {
        return privileged;
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