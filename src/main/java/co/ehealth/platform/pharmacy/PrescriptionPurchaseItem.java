package co.ehealth.platform.pharmacy;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.util.UUID;

// A medicine the prescriber wants the patient to buy outside the clinic
// pharmacy's stock. It is part of the prescription (so it prints on it and
// shows on the pharmacy screens) but is never dispensed, never deducted from
// stock, and never keeps the prescription waiting in the dispensing queue.
@Entity
@Table(name = "prescription_purchase_items")
public class PrescriptionPurchaseItem {

    @Id
    @GeneratedValue
    private UUID id;

    @Column(name = "prescription_id", nullable = false)
    private UUID prescriptionId;

    @Column(name = "drug_name", nullable = false, length = 200)
    private String drugName;

    @Column(nullable = false, length = 100)
    private String dosage;

    @Column(nullable = false)
    private int quantity;

    // Set when the prescriber picked the medicine from the pharmacy's list.
    @Column(name = "product_id")
    private UUID productId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private PurchaseReason reason;

    @Column(length = 300)
    private String note;

    protected PrescriptionPurchaseItem() {
    }

    public PrescriptionPurchaseItem(UUID prescriptionId, String drugName, String dosage, int quantity,
                                    UUID productId, PurchaseReason reason, String note) {
        this.prescriptionId = prescriptionId;
        this.drugName = drugName;
        this.dosage = dosage;
        this.quantity = quantity;
        this.productId = productId;
        this.reason = reason;
        this.note = note;
    }

    public UUID getId() {
        return id;
    }

    public UUID getPrescriptionId() {
        return prescriptionId;
    }

    public String getDrugName() {
        return drugName;
    }

    public String getDosage() {
        return dosage;
    }

    public int getQuantity() {
        return quantity;
    }

    public UUID getProductId() {
        return productId;
    }

    public PurchaseReason getReason() {
        return reason;
    }

    public String getNote() {
        return note;
    }
}
