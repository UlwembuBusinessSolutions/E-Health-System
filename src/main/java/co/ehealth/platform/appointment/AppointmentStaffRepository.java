package co.ehealth.platform.appointment;

import org.springframework.data.repository.Repository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.*;

// Reception only needs names and designations, not the admin staff/HR payload.
public interface AppointmentStaffRepository extends Repository<Appointment, UUID> {
    interface StaffOption {
        UUID getId();
        String getName();
        String getDesignation();
    }

    // Match ConsultationService's clinical roles. Grouping keeps staff with
    // multiple roles in one option; role names provide a useful label when
    // the optional designation has not been entered.
    @Query(value = """
        SELECT u.id AS id, CONCAT(u.first_name, ' ', u.last_name) AS name,
            COALESCE(NULLIF(TRIM(u.designation), ''), STRING_AGG(DISTINCT r.name, ', ' ORDER BY r.name)) AS designation
        FROM users u
        JOIN user_roles ur ON ur.user_id = u.id
        JOIN roles r ON r.id = ur.role_id
        WHERE u.status = 'ACTIVE'
        AND r.name IN ('Doctor', 'Professional Nurse', 'Clinician', 'Occupational Health Practitioner')
        AND (u.facility_id = :facilityId OR EXISTS (
            SELECT 1 FROM user_facilities uf WHERE uf.user_id = u.id AND uf.facility_id = :facilityId))
        GROUP BY u.id, u.first_name, u.last_name, u.designation
        ORDER BY u.last_name, u.first_name, u.id
        """, nativeQuery = true)
    List<StaffOption> findAvailable(@Param("facilityId") UUID facilityId);

    // Keep names visible on historical bookings even when a staff member is disabled or moves facilities.
    @Query(value = """
        SELECT u.id AS id, CONCAT(u.first_name, ' ', u.last_name) AS name, u.designation AS designation
        FROM users u WHERE u.id IN (:ids)
        """, nativeQuery = true)
    List<StaffOption> findNames(@Param("ids") Collection<UUID> ids);
}
