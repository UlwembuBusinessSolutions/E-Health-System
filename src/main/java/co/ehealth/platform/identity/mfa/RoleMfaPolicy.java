package co.ehealth.platform.identity.mfa;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "role_mfa_policies")
public class RoleMfaPolicy {
    @Id
    @Column(name = "role_id")
    UUID roleId;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    MfaPolicy policy;
    @Column(name = "updated_by")
    UUID updatedBy;
    @Column(name = "updated_at", nullable = false)
    Instant updatedAt;

    protected RoleMfaPolicy() {
    }

    RoleMfaPolicy(UUID roleId) {
        this.roleId = roleId;
    }

    void set(MfaPolicy policy, UUID by, Instant at) {
        this.policy = policy;
        this.updatedBy = by;
        this.updatedAt = at;
    }
}