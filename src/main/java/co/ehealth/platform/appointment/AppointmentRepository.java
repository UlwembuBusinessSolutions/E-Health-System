package co.ehealth.platform.appointment;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public interface AppointmentRepository extends JpaRepository<Appointment, UUID> {
    long countByFacilityIdAndAppointmentDateAndStatusNot(UUID facilityId, LocalDate date, String status);

    // Supersedes the old bare findByFacilityIdAndAppointmentDateOrderBy...()
    // — AppointmentService.diary()'s new optional status/assigned-clinician
    // filters (view-only; never affect the daily-limit counts, which stay on
    // countByFacilityIdAndAppointmentDateAndStatusNot above) need a query
    // that can apply each one only when actually asked for. The
    // `:x IS NULL OR a.x = :x` shape short-circuits to "no constraint" for
    // any parameter left null.
    @Query("""
            SELECT a FROM Appointment a
            WHERE a.facilityId = :facilityId AND a.appointmentDate = :date
            AND (:status IS NULL OR a.status = :status)
            AND (:unassignedOnly = false OR a.assignedStaffId IS NULL)
            AND (:assignedStaffId IS NULL OR a.assignedStaffId = :assignedStaffId)
            ORDER BY a.appointmentTime ASC, a.id ASC
            """)
    Page<Appointment> search(@Param("facilityId") UUID facilityId, @Param("date") LocalDate date,
            @Param("status") String status, @Param("unassignedOnly") boolean unassignedOnly,
            @Param("assignedStaffId") UUID assignedStaffId, Pageable pageable);

    // AppointmentService.checkStaffAvailability()'s own candidate set — same
    // clinician, same local day, not cancelled. A day's worth of one
    // clinician's appointments is small enough to fetch and compare in Java
    // rather than push the +/- N minute window into SQL.
    List<Appointment> findByFacilityIdAndAssignedStaffIdAndAppointmentDateAndStatusNot(
            UUID facilityId, UUID assignedStaffId, LocalDate date, String status);
}
