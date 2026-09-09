package co.ehealth.platform.facility;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface StationRepository extends JpaRepository<Station, UUID> {
    List<Station> findByFacilityIdAndActiveTrue(UUID facilityId);
    boolean existsByFacilityIdAndCode(UUID facilityId, String code);
}
