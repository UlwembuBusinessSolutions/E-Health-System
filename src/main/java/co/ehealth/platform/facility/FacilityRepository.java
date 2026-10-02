package co.ehealth.platform.facility;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface FacilityRepository extends JpaRepository<Facility, UUID> {
    // All appointment mutations and capacity-setting changes share this lock.
    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @org.springframework.data.jpa.repository.Query("select f from Facility f where f.id = :id")
    java.util.Optional<Facility> lockForAppointments(@org.springframework.data.repository.query.Param("id") UUID id);
    // OrderByName, not the previous bare findByActiveTrue(): with no ORDER BY,
    // Postgres makes no ordering guarantee at all, so which facility ended up
    // first (and therefore which one the Appointments page silently defaults
    // to) varied between otherwise-identical page loads — confusing when
    // that facility happens to have no clinical staff assigned yet, since the
    // "Appointment with" dropdown then looks broken rather than correctly empty.
    List<Facility> findByActiveTrueOrderByNameAsc();

    // FacilityService.findPharmacyFacility() — ConsultationService's "Send
    // to pharmacy" outcome needs to resolve the org's pharmacy facility by
    // type, not by a caller-supplied id.
    List<Facility> findByTypeAndActiveTrue(FacilityType type);

    boolean existsByCode(String code);
    boolean existsByCodeAndIdNot(String code, UUID id);
}
