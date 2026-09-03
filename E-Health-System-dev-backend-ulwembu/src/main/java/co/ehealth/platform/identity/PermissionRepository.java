package co.ehealth.platform.identity;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

public interface PermissionRepository extends JpaRepository<Permission, UUID> {

    // The evaluation read: every permission code granted across ANY of the
    // caller's roles (a user can hold more than one — user_roles is a real
    // many-to-many, see its own why-note on facility scoping). Native, not
    // JPQL, same reasoning as every other join-table read in this codebase
    // (UserRepository.findRoleNames() etc.) — role_permissions has no JPA
    // entity of its own, only Role and Permission do, so there's no JPQL
    // path through the association at all.
    @Query(value = """
            SELECT DISTINCT p.code FROM permissions p
            JOIN role_permissions rp ON rp.permission_id = p.id
            JOIN roles r ON r.id = rp.role_id
            WHERE r.name IN (:roleNames)
            """, nativeQuery = true)
    List<String> findCodesByRoleNames(@Param("roleNames") Collection<String> roleNames);
}
