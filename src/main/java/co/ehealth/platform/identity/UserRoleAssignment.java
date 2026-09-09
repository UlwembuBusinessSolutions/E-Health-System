package co.ehealth.platform.identity;

// lihle | 2026-09-09 | Aligned staff roles and clinic assignments so permissions follow the current clinic context.

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.util.UUID;

@Entity
@Table(name = "user_roles")
public class UserRoleAssignment {
    @Id @GeneratedValue
    private UUID id;
    @Column(name = "user_id", nullable = false)
    private UUID userId;
    @Column(name = "role_id", nullable = false)
    private UUID roleId;
    @Column(name = "facility_id")
    private UUID facilityId;

    protected UserRoleAssignment() { }

    public UUID getId() { return id; }
    public UUID getUserId() { return userId; }
    public UUID getRoleId() { return roleId; }
    public UUID getFacilityId() { return facilityId; }
}
