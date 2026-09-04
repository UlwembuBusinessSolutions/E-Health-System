package co.ehealth.platform.pharmacy;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "stock_batches")
public class StockBatch {

    @Id
    @GeneratedValue
    private UUID id;

    @Column(name = "facility_id", nullable = false)
    private UUID facilityId;

    @Column(name = "drug_name", nullable = false, length = 200)
    private String drugName;

    @Column(name = "batch_number", nullable = false, length = 100)
    private String batchNumber;

    @Column(nullable = false, unique = true, length = 150)
    private String barcode;

    @Column(name = "expiry_date", nullable = false)
    private LocalDate expiryDate;

    @Column(name = "quantity_on_hand", nullable = false)
    private int quantityOnHand;

    protected StockBatch() {
    }

    public StockBatch(UUID facilityId, String drugName, String batchNumber, String barcode,
                      LocalDate expiryDate, int quantityOnHand) {
        this.facilityId = facilityId;
        this.drugName = drugName;
        this.batchNumber = batchNumber;
        this.barcode = barcode;
        this.expiryDate = expiryDate;
        this.quantityOnHand = quantityOnHand;
    }

    public void removeQuantity(int quantity) {
        if (quantity < 1 || quantity > quantityOnHand) {
            throw new IllegalArgumentException("Insufficient stock in this batch.");
        }
        quantityOnHand -= quantity;
    }

    public UUID getId() { return id; }
    public UUID getFacilityId() { return facilityId; }
    public String getDrugName() { return drugName; }
    public String getBatchNumber() { return batchNumber; }
    public String getBarcode() { return barcode; }
    public LocalDate getExpiryDate() { return expiryDate; }
    public int getQuantityOnHand() { return quantityOnHand; }
}
