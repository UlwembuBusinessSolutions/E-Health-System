package co.ehealth.platform.pharmacy;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

// PHRM-US-018's "Prescription must bind to a valid MPI number" — patientId
// is required and comes from the Visit this prescription was written
// against (PrescriptionService.create()'s own why-note on why visitId is
// the thing a caller actually supplies, not patientId directly): every
// Visit already has a validated patientId from the moment it was created,
// so binding through it is strictly safer than trusting a second,
// independently-supplied patient id to agree with the first. No
// consultationId — the FRS's own Prescription.consultation_id would tie
// this to a Consultation entity that doesn't exist yet (Phase 2,
// CSAC/CSCC/CSMC/TELE's shared dependency, same class of gap RECQ's own
// Visit dependency was) — out of scope for this slice, so prescriptions
// originate directly from a visit instead.
@Entity
@Table(name = "prescriptions")
public class Prescription {

    @Id
    @GeneratedValue
    private UUID id;

    @Column(name = "serial_number", nullable = false, unique = true, length = 20)
    private String serialNumber;

    @Column(name = "visit_id", nullable = false)
    private UUID visitId;

    @Column(name = "patient_id", nullable = false)
    private UUID patientId;

    @Column(name = "facility_id", nullable = false)
    private UUID facilityId;

    @Column(name = "prescriber_id", nullable = false)
    private UUID prescriberId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private PrescriptionStatus status;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    protected Prescription() {
    }

    public Prescription(String serialNumber, UUID visitId, UUID patientId, UUID facilityId, UUID prescriberId,
                         Instant createdAt) {
        this.serialNumber = serialNumber;
        this.visitId = visitId;
        this.patientId = patientId;
        this.facilityId = facilityId;
        this.prescriberId = prescriberId;
        this.status = PrescriptionStatus.PENDING;
        this.createdAt = createdAt;
    }

    // PrescriptionService.dispense() — the only status transition this
    // slice has (partial dispensing, PHRM-US-006, is Sprint 5, out of
    // scope: a prescription is dispensed in full or not at all here).
    public void markDispensed() {
        this.status = PrescriptionStatus.DISPENSED;
    }

    public UUID getId() {
        return id;
    }

    public String getSerialNumber() {
        return serialNumber;
    }

    public UUID getVisitId() {
        return visitId;
    }

    public UUID getPatientId() {
        return patientId;
    }

    public UUID getFacilityId() {
        return facilityId;
    }

    public UUID getPrescriberId() {
        return prescriberId;
    }

    public PrescriptionStatus getStatus() {
        return status;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
