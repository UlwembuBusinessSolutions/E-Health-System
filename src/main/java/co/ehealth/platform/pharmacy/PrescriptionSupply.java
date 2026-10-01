package co.ehealth.platform.pharmacy;

import jakarta.persistence.*;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

/** Immutable event: partial dispensing creates another row rather than overwriting coverage. */
@Entity
@Table(name = "prescription_supplies")
public class PrescriptionSupply {
    @Id private UUID id;
    @Column(name = "prescription_item_id", nullable = false) private UUID prescriptionItemId;
    @Column(name = "patient_id", nullable = false) private UUID patientId;
    @Column(name = "product_id", nullable = false) private UUID productId;
    @Column(name = "facility_id", nullable = false) private UUID facilityId;
    @Column(name = "dispensed_by", nullable = false) private UUID dispensedBy;
    @Column(name = "dispensed_at", nullable = false) private Instant dispensedAt;
    @Column(name = "supply_until", nullable = false) private LocalDate supplyUntil;
    @Column(nullable = false) private int quantity;

    protected PrescriptionSupply() {}
    public PrescriptionSupply(Prescription p, PrescriptionItem item, UUID actor, Instant at,
                              LocalDate until, int quantity) {
        this.id = UUID.randomUUID(); this.prescriptionItemId = item.getId(); this.patientId = p.getPatientId();
        this.productId = item.getProductId(); this.facilityId = p.getFacilityId(); this.dispensedBy = actor;
        this.dispensedAt = at; this.supplyUntil = until; this.quantity = quantity;
    }
    public UUID getId() { return id; }
    public UUID getPrescriptionItemId() { return prescriptionItemId; }
    public UUID getFacilityId() { return facilityId; }
    public Instant getDispensedAt() { return dispensedAt; }
    public LocalDate getSupplyUntil() { return supplyUntil; }
    public int getQuantity() { return quantity; }
}
