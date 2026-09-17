package co.ehealth.platform.facility;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.*;
public interface ServiceStationRepository extends JpaRepository<ServiceStation, UUID> {
    List<ServiceStation> findByFacilityIdOrderByName(UUID facilityId);
    Optional<ServiceStation> findByIdAndFacilityId(UUID id, UUID facilityId);
}
