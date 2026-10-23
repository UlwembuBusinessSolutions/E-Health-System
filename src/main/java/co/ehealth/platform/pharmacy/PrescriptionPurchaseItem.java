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

    @Column(nullable = false, length = 300)
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

    @Column(name = "strength_form", length = 100)
    private String strengthForm;

    @Column(length = 100)
    private String dose;

    @Column(length = 30)
    private String route;

    @Column(length = 120)
    private String frequency;

    @Column(length = 100)
    private String duration;

    @Column(name = "quantity_unit", length = 20)
    private String quantityUnit;

    @Column(length = 500)
    private String instructions;

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

    // The directions as separate facts, or null for a line written before they were recorded.
    public MedicineDirections directions() {
        MedicineDirections directions = new MedicineDirections(strengthForm, dose, route, frequency, duration,
                quantityUnit, instructions);
        return directions.isEmpty() ? null : directions;
    }

    public void applyDirections(MedicineDirections directions) {
        if (directions == null) {
            return;
        }
        this.strengthForm = blankToNull(directions.strengthForm());
        this.dose = blankToNull(directions.dose());
        this.route = blankToNull(directions.route());
        this.frequency = blankToNull(directions.frequency());
        this.duration = blankToNull(directions.duration());
        this.quantityUnit = blankToNull(directions.quantityUnit());
        this.instructions = blankToNull(directions.instructions());
    }

    private static String blankToNull(String text) {
        return text == null || text.isBlank() ? null : text.trim();
    }
}
