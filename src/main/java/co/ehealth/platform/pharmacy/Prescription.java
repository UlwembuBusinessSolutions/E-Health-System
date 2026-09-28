package co.ehealth.platform.pharmacy;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

// PHRM-US-018's "Prescription must bind to a valid MPI number" — patientId
// is required and comes from the Visit this prescription was written
// against (PrescriptionService.create()'s own why-note on why visitId is
// the thing a caller actually supplies, not patientId directly): every
// Visit already has a validated patientId from the moment it was created,
// so binding through it is strictly safer than trusting a second,
// independently-supplied patient id to agree with the first.
//
// consultationId is optional traceability only, not a required binding —
// prescriptions still originate directly from a visit and work exactly as
// before when it's absent. It's set only when a prescriber creates this
// from within a signed Consultation's "Send to pharmacy" outcome
// (co.ehealth.platform.consultation), so the UI can show "which
// consultation led to this script." Never gates or changes create()/
// dispense()'s behaviour.
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

    @Column(name = "consultation_id")
    private UUID consultationId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private PrescriptionStatus status;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    protected Prescription() {
    }

    public Prescription(String serialNumber, UUID visitId, UUID patientId, UUID facilityId, UUID prescriberId,
                         Instant createdAt) {
        this(serialNumber, visitId, patientId, facilityId, prescriberId, createdAt, null);
    }

    public Prescription(String serialNumber, UUID visitId, UUID patientId, UUID facilityId, UUID prescriberId,
                         Instant createdAt, UUID consultationId) {
        this.serialNumber = serialNumber;
        this.visitId = visitId;
        this.patientId = patientId;
        this.facilityId = facilityId;
        this.prescriberId = prescriberId;
        this.status = PrescriptionStatus.PENDING;
        this.createdAt = createdAt;
        this.consultationId = consultationId;
    }

    // This prescription's status is never set directly — it's a rollup of
    // its own items' statuses, recomputed by PrescriptionService after every
    // item-level dispense/markOutOfStock. PENDING only while every item
    // still is; PARTIALLY_DISPENSED once some items are resolved but at
    // least one still needs action (this is what keeps a prescription
    // showing in the facility queue — see PrescriptionRepository's own
    // why-note); once nothing is left PENDING, OUT_OF_STOCK if any item
    // ended up stuck there (however many others were dispensed — that's
    // still unfinished business, findable later by serial number), else
    // DISPENSED.
    public void recomputeStatus(List<PrescriptionItem> items) {
        long pending = items.stream().filter(i -> i.getStatus() == PrescriptionStatus.PENDING).count();
        long outOfStock = items.stream().filter(i -> i.getStatus() == PrescriptionStatus.OUT_OF_STOCK).count();
        if (pending == items.size()) {
            this.status = PrescriptionStatus.PENDING;
        } else if (pending > 0) {
            this.status = PrescriptionStatus.PARTIALLY_DISPENSED;
        } else if (outOfStock > 0) {
            this.status = PrescriptionStatus.OUT_OF_STOCK;
        } else {
            this.status = PrescriptionStatus.DISPENSED;
        }
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

    public UUID getConsultationId() {
        return consultationId;
    }

    public PrescriptionStatus getStatus() {
        return status;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
