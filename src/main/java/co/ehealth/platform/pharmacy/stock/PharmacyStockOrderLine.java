package co.ehealth.platform.pharmacy.stock;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.util.UUID;

@Entity
@Table(name = "pharmacy_stock_order_lines")
public class PharmacyStockOrderLine {

    @Id
    @GeneratedValue
    private UUID id;

    @Column(name = "order_id", nullable = false)
    private UUID orderId;

    @Column(name = "product_id", nullable = false)
    private UUID productId;

    @Column(name = "product_code", nullable = false, length = 50)
    private String productCode;

    @Column(name = "product_name", nullable = false, length = 200)
    private String productName;

    @Column(name = "base_unit", nullable = false, length = 20)
    private String baseUnit;

    @Column(nullable = false)
    private int quantity;

    protected PharmacyStockOrderLine() {
    }

    public PharmacyStockOrderLine(UUID orderId, PharmacyProduct product, int quantity) {
        this.orderId = orderId;
        this.productId = product.getId();
        this.productCode = product.getCode();
        this.productName = product.getDisplayName();
        this.baseUnit = product.getBaseUnit().name();
        this.quantity = quantity;
    }

    public UUID getId() { return id; }
    public UUID getOrderId() { return orderId; }
    public UUID getProductId() { return productId; }
    public String getProductCode() { return productCode; }
    public String getProductName() { return productName; }
    public String getBaseUnit() { return baseUnit; }
    public int getQuantity() { return quantity; }
}