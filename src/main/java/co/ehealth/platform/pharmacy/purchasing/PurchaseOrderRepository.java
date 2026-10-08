package co.ehealth.platform.pharmacy.purchasing;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

public interface PurchaseOrderRepository extends JpaRepository<PurchaseOrder, UUID> {

    @Query(value = "SELECT nextval('pharmacy_purchase_order_number_seq')", nativeQuery = true)
    long nextOrderNumberValue();

    // supplierId uses the IS NULL idiom proven by the ledger query. Newest
    // first; id breaks ties so paging never repeats or skips an order.
    @Query("SELECT o FROM PurchaseOrder o WHERE o.facilityId = :facilityId "
            + "AND (:supplierId IS NULL OR o.supplierId = :supplierId) "
            + "ORDER BY o.createdAt DESC, o.id DESC")
    Page<PurchaseOrder> search(@Param("facilityId") UUID facilityId, @Param("supplierId") UUID supplierId,
                               Pageable pageable);

    // The latest order per supplier in one grouped query, for the supplier list.
    @Query("SELECT new co.ehealth.platform.pharmacy.purchasing.SupplierLastOrdered(o.supplierId, MAX(o.createdAt)) "
            + "FROM PurchaseOrder o WHERE o.facilityId = :facilityId AND o.supplierId IN :supplierIds "
            + "GROUP BY o.supplierId")
    List<SupplierLastOrdered> latestOrderBySupplier(@Param("facilityId") UUID facilityId,
                                                    @Param("supplierIds") Collection<UUID> supplierIds);

    // Used when two suppliers are merged: the orders follow the survivor.
    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("UPDATE PurchaseOrder o SET o.supplierId = :targetId WHERE o.supplierId = :sourceId")
    void repointSupplier(@Param("sourceId") UUID sourceId, @Param("targetId") UUID targetId);
}
