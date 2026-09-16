package co.ehealth.platform.pharmacy;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

// One row per dispensed prescription — prescriptionId is unique because
// this slice dispenses in full or not at all (Prescription's own why-note),
// so there's never more than one DispensingRecord per prescription yet.
@Entity
@Table(name = "dispensing_records")
public class DispensingRecord {

    @Id
    @GeneratedValue
    private UUID id;

    @Column(name = "prescription_id", nullable = false, unique = true)
    private UUID prescriptionId;

    @Column(name = "dispensed_by_user_id", nullable = false)
    private UUID dispensedByUserId;

    @Column(name = "dispensed_at", nullable = false)
    private Instant dispensedAt;

    protected DispensingRecord() {
    }

    public DispensingRecord(UUID prescriptionId, UUID dispensedByUserId, Instant dispensedAt) {
        this.prescriptionId = prescriptionId;
        this.dispensedByUserId = dispensedByUserId;
        this.dispensedAt = dispensedAt;
    }

    public UUID getId() {
        return id;
    }

    public UUID getPrescriptionId() {
        return prescriptionId;
    }

    public UUID getDispensedByUserId() {
        return dispensedByUserId;
    }

    public Instant getDispensedAt() {
        return dispensedAt;
    }
}
