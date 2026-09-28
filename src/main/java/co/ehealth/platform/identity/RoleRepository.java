package co.ehealth.platform.identity;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface RoleRepository extends JpaRepository<Role, UUID> {
    // Used by OrganizationProvisioningService to resolve the seeded
    // 'ORG_ADMIN' role's id when creating an organization's admin(s) — the
    // one place in this codebase that looks a role up by name rather than
    // by id.
    Optional<Role> findByName(String name);
}
