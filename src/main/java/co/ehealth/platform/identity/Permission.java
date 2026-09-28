package co.ehealth.platform.identity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.util.UUID;

// One row per (ModuleCode, PermissionLevel) — "<MODULE>:<LEVEL>", e.g.
// "PHRM:MANAGE". The table (and role_permissions, its join to Role) already
// existed in V2__identity.sql with no JPA entity mapped to it — this is the
// entity that catches up to that schema, not a new table (IAM-US-009).
@Entity
@Table(name = "permissions")
public class Permission {

    @Id
    @GeneratedValue
    private UUID id;

    @Column(nullable = false, unique = true, length = 100)
    private String code;

    protected Permission() {
    }

    public UUID getId() {
        return id;
    }

    public String getCode() {
        return code;
    }
}
