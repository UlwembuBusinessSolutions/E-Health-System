package co.ehealth.platform.pharmacy.register;

import co.ehealth.platform.identity.User;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.UUID;

// Finds the staff who could witness a Schedule 6 entry. Reads only the
// three columns the witness picker shows — never emails or other details.
public interface RegisterWitnessRepository extends Repository<User, UUID> {

    interface WitnessRow {
        UUID getId();

        String getFirstName();

        String getLastName();
    }

    // Native because role -> permission is a join through tables that have no
    // JPA path (see PermissionRepository). "Can access the pharmacy" means
    // the staff member works at the facility and one of their roles holds
    // PHRM:VIEW or PHRM:MANAGE.
    @Query(value = """
            SELECT DISTINCT u.id AS "id", u.first_name AS "firstName", u.last_name AS "lastName"
            FROM users u
            JOIN user_facilities uf ON uf.user_id = u.id
            JOIN user_roles ur ON ur.user_id = u.id
            JOIN role_permissions rp ON rp.role_id = ur.role_id
            JOIN permissions p ON p.id = rp.permission_id
            WHERE uf.facility_id = :facilityId
              AND u.status = 'ACTIVE'
              AND u.id <> :excludedUserId
              AND p.code IN ('PHRM:VIEW', 'PHRM:MANAGE')
            ORDER BY u.first_name, u.last_name
            """, nativeQuery = true)
    List<WitnessRow> findPharmacyStaff(@Param("facilityId") UUID facilityId,
                                       @Param("excludedUserId") UUID excludedUserId);
}
