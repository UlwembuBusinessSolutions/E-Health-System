package co.ehealth.platform.facility;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface FacilityRepository extends JpaRepository<Facility, UUID> {
    List<Facility> findByActiveTrue();

    // FacilityService.findPharmacyFacility() — ConsultationService's "Send
    // to pharmacy" outcome needs to resolve the org's pharmacy facility by
    // type, not by a caller-supplied id.
    List<Facility> findByTypeAndActiveTrue(FacilityType type);

    boolean existsByCode(String code);
    boolean existsByCodeAndIdNot(String code, UUID id);
}
