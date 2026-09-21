package co.ehealth.platform.pharmacy.stock;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface PharmacyStockLocationRepository extends JpaRepository<PharmacyStockLocation, UUID> {
    Optional<PharmacyStockLocation> findByFacilityIdAndCode(UUID facilityId, String code);
}
