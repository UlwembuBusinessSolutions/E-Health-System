package co.ehealth.platform.pharmacy.register;

import co.ehealth.platform.pharmacy.stock.PharmacyProduct;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.UUID;

// The scheduled products a facility stocks, for the register's product picker.
public interface RegisterProductRepository extends Repository<PharmacyProduct, UUID> {

    @Query("SELECT p FROM PharmacyProduct p, PharmacyFacilityProduct fp WHERE fp.productId = p.id "
            + "AND fp.facilityId = :facilityId AND fp.active = true AND p.active = true "
            + "AND p.schedule IS NOT NULL ORDER BY p.displayName ASC")
    List<PharmacyProduct> findScheduledAtFacility(@Param("facilityId") UUID facilityId);
}
