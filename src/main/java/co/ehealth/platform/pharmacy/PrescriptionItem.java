package co.ehealth.platform.pharmacy;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
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

    @Column(name = "dispensed_quantity", nullable = false)
    private int dispensedQuantity;

    @Column(name = "product_id")
    private UUID productId;
    @Enumerated(EnumType.STRING)
    @Column(name = "clinical_check_status", nullable = false, length = 20)
    private ClinicalCheckStatus clinicalCheckStatus = ClinicalCheckStatus.REVIEW_REQUIRED;
    @Column(name = "clinical_check_note", length = 500)
    private String clinicalCheckNote;
    @Column(name = "reviewed_by")
    private UUID reviewedBy;
    @Column(name = "reviewed_at")
    private java.time.Instant reviewedAt;

    @Enumerated(EnumType.STRING)
    @Column(name = "decline_reason", length = 40)
    private DeclineReason declineReason;
    @Column(name = "decline_note", length = 500)
    private String declineNote;
    @Column(name = "declined_by")
    private UUID declinedBy;
    @Column(name = "declined_at")
    private java.time.Instant declinedAt;

    public DeclineReason getDeclineReason() { return declineReason; }
    public String getDeclineNote() { return declineNote; }
    public UUID getDeclinedBy() { return declinedBy; }
    public java.time.Instant getDeclinedAt() { return declinedAt; }

    public void decline(DeclineReason reason, String note, UUID actor, java.time.Instant at) {
        requireNotDeclined();
        if (status == PrescriptionStatus.DISPENSED)
            throw new InvalidDispenseException("A fully dispensed item cannot be declined.");
        if (reason == null || actor == null || at == null || (note != null && note.length() > 500)
                || (reason == DeclineReason.OTHER && (note == null || note.isBlank())))
            throw new InvalidDispenseException("A decline reason is required; OTHER also requires a note (maximum 500 characters).");
        declineReason = reason; declineNote = note == null || note.isBlank() ? null : note.trim();
        declinedBy = actor; declinedAt = at; status = PrescriptionStatus.DECLINED;
    }

    private void requireNotDeclined() {
        if (status == PrescriptionStatus.DECLINED)
            throw new InvalidDispenseException("This item has been declined. A new prescription is required to supply it.");
    }

    public UUID getProductId() { return productId; }
    public ClinicalCheckStatus getClinicalCheckStatus() { return clinicalCheckStatus; }
    public String getClinicalCheckNote() { return clinicalCheckNote; }
    public UUID getReviewedBy() { return reviewedBy; }
    public java.time.Instant getReviewedAt() { return reviewedAt; }

    public void review(UUID product, ClinicalCheckStatus result, String note, UUID reviewer, java.time.Instant at) {
        requireNotDeclined();
        if (product == null || result == null || note == null || note.isBlank() || note.length() > 500)
            throw new InvalidDispenseException("Select a product and record the clinical review outcome and note.");
        if (dispensedQuantity > 0 && productId != null && !product.equals(productId))
            throw new InvalidDispenseException("The product cannot change after a supply has been recorded.");
        if (status == PrescriptionStatus.DISPENSED)
            throw new InvalidDispenseException("A completed item cannot be reviewed again.");
        productId = product;
        clinicalCheckStatus = result;
        clinicalCheckNote = note.trim();
        reviewedBy = reviewer;
        reviewedAt = at;
    }

    // Partial supplies retain the remaining prescribed quantity.
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private PrescriptionStatus status;

    protected PrescriptionItem() {
    }

    public PrescriptionItem(UUID prescriptionId, String drugName, String dosage, int quantity) {
        this.prescriptionId = prescriptionId;
        this.drugName = drugName;
        this.dosage = dosage;
        this.quantity = quantity;
        this.status = PrescriptionStatus.PENDING;
    }

    // PrescriptionService.dispenseItem() — reversible the other way (see
    // markOutOfStock() below) but not from here: once dispensed, this item
    // is physically with the patient and stays terminal.
    public void markDispensed() {
        requireNotDeclined();
        this.dispensedQuantity = quantity;
        this.status = PrescriptionStatus.DISPENSED;
    }

    // PrescriptionService.markItemOutOfStock() — deliberately not terminal:
    // an item here can still move to DISPENSED once stock is back (that's
    // the whole point of the prescription-lookup-by-serial flow). Callable
    // again on an already-OUT_OF_STOCK item (idempotent) so a pharmacist
    // can update the note without it being an error.
    public void markOutOfStock() {
        requireNotDeclined();
        this.status = PrescriptionStatus.OUT_OF_STOCK;
    }

    public int getDispensedQuantity() { return dispensedQuantity; }
    public void dispenseQuantity(int amount) {
        requireNotDeclined();
        if (amount <= 0 || amount > quantity - dispensedQuantity)
            throw new InvalidDispenseException("Quantity must be positive and no greater than the remaining prescribed quantity.");
        dispensedQuantity += amount;
        status = dispensedQuantity == quantity ? PrescriptionStatus.DISPENSED : PrescriptionStatus.PARTIALLY_DISPENSED;
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

    public PrescriptionStatus getStatus() {
        return status;
    }
}
