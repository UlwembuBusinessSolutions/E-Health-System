package co.ehealth.platform.identity;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface UserRepository extends JpaRepository<User, UUID> {

    // The login lookup — email is the sole login identifier. employee_number
    // remains a real column but isn't queried for authentication anywhere.
    Optional<User> findByEmail(String email);

    Optional<User> findByEmployeeNumber(String employeeNumber);

    boolean existsByEmployeeNumber(String employeeNumber);

    boolean existsByIdNumber(String idNumber);

    boolean existsByEmail(String email);

    boolean existsByContactNumber(String contactNumber);

    boolean existsBySancNumber(String sancNumber);

    boolean existsByHpcsaNumber(String hpcsaNumber);

    boolean existsBySapcNumber(String sapcNumber);

    @Query(value = "select r.name from roles r, user_roles ur where ur.role_id = r.id and ur.user_id = :userId",
           nativeQuery = true)
    List<String> findRoleNames(@Param("userId") UUID userId);

    // OrganizationProvisioningService.listAdmins()/removeAdmin()'s lookup —
    // every user currently holding a given role, ORG_ADMIN in practice
    // today. Native, same reasoning as findRoleNames above: this is a join
    // across three tables with no natural Spring Data derived-query shape.
    @Query(value = "select u.* from users u "
            + "join user_roles ur on ur.user_id = u.id "
            + "join roles r on r.id = ur.role_id "
            + "where r.name = :roleName", nativeQuery = true)
    List<User> findByRoleName(@Param("roleName") String roleName);

    // The other half of assignRole() above — StaffService.revokeOrgAdminRole()'s
    // write. Deletes the specific (user, role) assignment; harmless no-op
    // if it's somehow already gone (e.g. a concurrent revoke), which is why
    // the last-admin/not-currently-an-admin checks happen in StaffService
    // before this runs, not by inspecting this call's affected-row count.
    @Modifying
    @Query(value = "delete from user_roles where user_id = :userId and role_id = :roleId", nativeQuery = true)
    void removeRole(@Param("userId") UUID userId, @Param("roleId") UUID roleId);

    // The one user_roles write this slice owns. Runs inside the caller's
    // existing @Transactional, so no extra annotation is needed here.
    @Modifying
    @Query(value = "insert into user_roles (id, user_id, role_id, facility_id) "
            + "values (gen_random_uuid(), :userId, :roleId, :facilityId)", nativeQuery = true)
    void assignRole(@Param("userId") UUID userId, @Param("roleId") UUID roleId, @Param("facilityId") UUID facilityId);

    // ON CONFLICT DO NOTHING because the primary facility gets assigned
    // through this same method as every additional one — if a caller ever
    // lists the primary facility twice, this is a no-op the second time
    // rather than a duplicate-key exception.
    @Modifying
    @Query(value = "insert into user_facilities (user_id, facility_id) values (:userId, :facilityId) "
            + "on conflict do nothing", nativeQuery = true)
    void assignFacility(@Param("userId") UUID userId, @Param("facilityId") UUID facilityId);
}
