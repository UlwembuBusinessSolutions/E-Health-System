package co.ehealth.platform.pharmacy;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

// A durable work item is safer than merely returning an error: staff can find
// every blocked dispense later and verify the patient's identity manually.
@Entity
@Table(name = "manual_verification_cases")
public class ManualVerificationCase {

    @Id
    @GeneratedValue
    private UUID id;

    @Column(name = "prescription_id", nullable = false, unique = true)
    private UUID prescriptionId;

    @Column(name = "patient_id", nullable = false)
    private UUID patientId;

    @Column(nullable = false, length = 300)
    private String reason;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    protected ManualVerificationCase() {
    }

    public ManualVerificationCase(UUID prescriptionId, UUID patientId, String reason, Instant createdAt) {
        this.prescriptionId = prescriptionId;
        this.patientId = patientId;
        this.reason = reason;
        this.createdAt = createdAt;
    }

    public UUID getId() { return id; }
    public UUID getPrescriptionId() { return prescriptionId; }
    public UUID getPatientId() { return patientId; }
    public String getReason() { return reason; }
    public Instant getCreatedAt() { return createdAt; }
}
