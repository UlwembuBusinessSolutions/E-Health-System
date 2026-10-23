package co.ehealth.platform.pharmacy.ccmdd;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.*;

public interface CcmddPickupPointRepository extends JpaRepository<CcmddPickupPoint, UUID> {
    Optional<CcmddPickupPoint> findBySynchId(String synchId);
    List<CcmddPickupPoint> findByActiveTrueOrderByNameAsc();
}
