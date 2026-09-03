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

    // A dispensing event must remain traceable to the same identified person
    // as its prescription, even when it is read without joining prescriptions.
    @Column(name = "patient_id", nullable = false)
    private UUID patientId;

    @Column(name = "patient_mpi", nullable = false, length = 20)
    private String patientMpi;

    @Column(name = "dispensed_by_user_id", nullable = false)
    private UUID dispensedByUserId;

    @Column(name = "dispensed_at", nullable = false)
    private Instant dispensedAt;

    protected DispensingRecord() {
    }

    public DispensingRecord(UUID prescriptionId, UUID patientId, String patientMpi, UUID dispensedByUserId,
                            Instant dispensedAt) {
        this.prescriptionId = prescriptionId;
        this.patientId = patientId;
        this.patientMpi = patientMpi;
        this.dispensedByUserId = dispensedByUserId;
        this.dispensedAt = dispensedAt;
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

    public UUID getDispensedByUserId() {
        return dispensedByUserId;
    }

    public Instant getDispensedAt() {
        return dispensedAt;
    }
}
