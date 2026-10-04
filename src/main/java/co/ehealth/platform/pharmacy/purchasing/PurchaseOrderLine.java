package co.ehealth.platform.pharmacy.purchasing;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.util.UUID;

// One product on an order: how many packs, how big each pack is, and the
// resulting number of units (always packs x packSize).
@Entity
@Table(name = "pharmacy_purchase_order_lines")
public class PurchaseOrderLine {

    @Id
    @GeneratedValue
    private UUID id;

    @Column(name = "purchase_order_id", nullable = false, updatable = false)
    private UUID purchaseOrderId;

    @Column(name = "product_id", nullable = false, updatable = false)
    private UUID productId;

    @Column(nullable = false, updatable = false)
    private int packs;

    @Column(name = "pack_size", nullable = false, updatable = false)
    private int packSize;

    @Column(nullable = false, updatable = false)
    private int quantity;

    protected PurchaseOrderLine() {
    }

    public PurchaseOrderLine(UUID purchaseOrderId, UUID productId, int packs, int packSize, int quantity) {
        this.purchaseOrderId = purchaseOrderId;
        this.productId = productId;
        this.packs = packs;
        this.packSize = packSize;
        this.quantity = quantity;
    }

    public UUID getId() {
        return id;
    }

    public UUID getPurchaseOrderId() {
        return purchaseOrderId;
    }

    public UUID getProductId() {
        return productId;
    }

    public int getPacks() {
        return packs;
    }

    public int getPackSize() {
        return packSize;
    }

    public int getQuantity() {
        return quantity;
    }
}
