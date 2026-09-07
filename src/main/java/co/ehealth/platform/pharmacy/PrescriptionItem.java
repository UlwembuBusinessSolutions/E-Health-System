package co.ehealth.platform.pharmacy;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.util.UUID;

// A plain drugName/dosage/quantity line, not a StockItem/formulary_code
// reference — "Restrict to approved formulary" is PHRM-US-010, explicitly
// Blocked/Not Ready in the backlog (BRD Open Item OI-012, no formulary
// source of truth exists yet), so an item here is free text a prescriber
// writes, same as a paper script would carry, not a lookup against
// inventory this codebase doesn't have.
@Entity
@Table(name = "prescription_items")
public class PrescriptionItem {

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

    protected PrescriptionItem() {
    }

    public PrescriptionItem(UUID prescriptionId, String drugName, String dosage, int quantity) {
        this.prescriptionId = prescriptionId;
        this.drugName = drugName;
        this.dosage = dosage;
        this.quantity = quantity;
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
}
