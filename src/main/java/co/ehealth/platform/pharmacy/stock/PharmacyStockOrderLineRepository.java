package co.ehealth.platform.pharmacy.stock;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

public interface PharmacyStockOrderLineRepository extends JpaRepository<PharmacyStockOrderLine, UUID> {
    List<PharmacyStockOrderLine> findByOrderIdOrderByIdAsc(UUID orderId);
    List<PharmacyStockOrderLine> findByOrderIdInOrderByOrderIdAscIdAsc(Collection<UUID> orderIds);
}