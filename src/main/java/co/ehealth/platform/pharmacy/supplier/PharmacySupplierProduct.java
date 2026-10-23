package co.ehealth.platform.pharmacy.supplier;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.IdClass;
import jakarta.persistence.Table;

import java.io.Serializable;
import java.time.Instant;
import java.util.UUID;

// "This supplier sells this product" — the order list behind the reorder page.
@Entity
@Table(name = "pharmacy_supplier_products")
@IdClass(PharmacySupplierProduct.Key.class)
public class PharmacySupplierProduct {

    public record Key(UUID supplierId, UUID productId) implements Serializable {
    }

    @Id
    @Column(name = "supplier_id")
    private UUID supplierId;

    @Id
    @Column(name = "product_id")
    private UUID productId;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    protected PharmacySupplierProduct() {
    }

    public PharmacySupplierProduct(UUID supplierId, UUID productId, Instant createdAt) {
        this.supplierId = supplierId;
        this.productId = productId;
        this.createdAt = createdAt;
    }

    public UUID getSupplierId() {
        return supplierId;
    }

    public UUID getProductId() {
        return productId;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
