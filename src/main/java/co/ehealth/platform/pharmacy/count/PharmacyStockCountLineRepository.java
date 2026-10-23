package co.ehealth.platform.pharmacy.count;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface PharmacyStockCountLineRepository extends JpaRepository<PharmacyStockCountLine, UUID> {

    List<PharmacyStockCountLine> findByCountId(UUID countId);

    List<PharmacyStockCountLine> findByCountIdIn(Collection<UUID> countIds);

    Optional<PharmacyStockCountLine> findByIdAndCountId(UUID id, UUID countId);

    boolean existsByCountIdAndProductIdAndLotNumberIgnoreCase(UUID countId, UUID productId, String lotNumber);
}
