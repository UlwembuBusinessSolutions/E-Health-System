package co.ehealth.platform.pharmacy.purchasing;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

public interface PurchaseOrderLineRepository extends JpaRepository<PurchaseOrderLine, UUID> {

    // One query for every order on a page.
    List<PurchaseOrderLine> findByPurchaseOrderIdIn(Collection<UUID> purchaseOrderIds);
}
