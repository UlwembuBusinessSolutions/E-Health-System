package co.ehealth.platform.pharmacy.supplier;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

public interface PharmacySupplierProductRepository
        extends JpaRepository<PharmacySupplierProduct, PharmacySupplierProduct.Key> {

    List<PharmacySupplierProduct> findBySupplierId(UUID supplierId);

    record ProductCount(UUID supplierId, long productCount) {
    }

    @Query("SELECT new co.ehealth.platform.pharmacy.supplier.PharmacySupplierProductRepository$ProductCount("
            + "sp.supplierId, COUNT(sp)) FROM PharmacySupplierProduct sp "
            + "WHERE sp.supplierId IN :supplierIds GROUP BY sp.supplierId")
    List<ProductCount> countBySupplierIds(@Param("supplierIds") Collection<UUID> supplierIds);

    // Copies the source's links to the target, skipping products the target
    // already sells (a plain INSERT would hit the primary key).
    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query(value = "INSERT INTO pharmacy_supplier_products (supplier_id, product_id, created_at) "
            + "SELECT :targetId, product_id, created_at FROM pharmacy_supplier_products "
            + "WHERE supplier_id = :sourceId ON CONFLICT DO NOTHING", nativeQuery = true)
    void copyLinks(@Param("sourceId") UUID sourceId, @Param("targetId") UUID targetId);

    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("DELETE FROM PharmacySupplierProduct sp WHERE sp.supplierId = :supplierId")
    void deleteAllForSupplier(@Param("supplierId") UUID supplierId);
}
