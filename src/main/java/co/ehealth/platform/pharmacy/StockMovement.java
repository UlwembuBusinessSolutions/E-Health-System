package co.ehealth.platform.pharmacy;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

// The pharmacy slice has no inventory-balance aggregate yet, but every
// dispense still needs an immutable movement trail tied to a named patient.

//Pay attention how oyu guys do the merge
@Entity
@Table(name = "stock_movements")
public class StockMovement {

    @Id
    @GeneratedValue
    private UUID id;

    @Column(name = "prescription_id", nullable = false)
    private UUID prescriptionId;

    @Column(name = "patient_id", nullable = false)
    private UUID patientId;

    @Column(name = "patient_mpi", nullable = false, length = 20)
    private String patientMpi;

    @Column(name = "drug_name", nullable = false, length = 200)
    private String drugName;

    @Column(nullable = false)
    private int quantity;

    @Column(name = "moved_at", nullable = false)
    private Instant movedAt;

    protected StockMovement() {
    }

    public StockMovement(UUID prescriptionId, UUID patientId, String patientMpi, String drugName, int quantity,
            Instant movedAt) {
        this.prescriptionId = prescriptionId;
        this.patientId = patientId;
        this.patientMpi = patientMpi;
        this.drugName = drugName;
        this.quantity = quantity;
        this.movedAt = movedAt;
    }

    public UUID getId() {
        return id;
    }

    public UUID getPrescriptionId() {
        return prescriptionId;
    }

    public UUID getPatientId() {
        return patientId;
    }

    public String getPatientMpi() {
        return patientMpi;
    }

    public String getDrugName() {
        return drugName;
    }

    public int getQuantity() {
        return quantity;
    }

    public Instant getMovedAt() {
        return movedAt;
    }
}
