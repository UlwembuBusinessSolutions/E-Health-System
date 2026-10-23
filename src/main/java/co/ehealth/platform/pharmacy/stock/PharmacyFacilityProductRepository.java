package co.ehealth.platform.pharmacy.stock;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface PharmacyFacilityProductRepository extends JpaRepository<PharmacyFacilityProduct, UUID> {
    Optional<PharmacyFacilityProduct> findByProductIdAndFacilityId(UUID productId, UUID facilityId);

    List<PharmacyFacilityProduct> findByFacilityIdAndActiveTrue(UUID facilityId);
}
