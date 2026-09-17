package co.ehealth.platform.pharmacy;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface StockReorderLevelRepository extends JpaRepository<StockReorderLevel, UUID> {
    List<StockReorderLevel> findByFacilityId(UUID facilityId);
    Optional<StockReorderLevel> findByFacilityIdAndDrugNameIgnoreCase(UUID facilityId, String drugName);
}
