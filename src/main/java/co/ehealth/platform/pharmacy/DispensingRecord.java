package co.ehealth.platform.pharmacy;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

// Latest supply summary per item; immutable supply history lives in the stock ledger.
@Entity
@Table(name = "dispensing_records")
public class DispensingRecord {

    @Id
    @GeneratedValue
    private UUID id;

    @Column(name = "prescription_item_id", nullable = false, unique = true)
    private UUID prescriptionItemId;

    @Column(name = "dispensed_by_user_id", nullable = false)
    private UUID dispensedByUserId;

    @Column(name = "dispensed_at", nullable = false)
    private Instant dispensedAt;

    protected DispensingRecord() {
    }

    public DispensingRecord(UUID prescriptionItemId, UUID dispensedByUserId, Instant dispensedAt) {
        this.prescriptionItemId = prescriptionItemId;
        this.dispensedByUserId = dispensedByUserId;
        this.dispensedAt = dispensedAt;
    }

    public void recordLatestDispense(UUID userId, Instant at) {
        this.dispensedByUserId = userId;
        this.dispensedAt = at;
    }
    public UUID getId() {
        return id;
    }

    public UUID getPrescriptionItemId() {
        return prescriptionItemId;
    }

    public UUID getDispensedByUserId() {
        return dispensedByUserId;
    }

    public Instant getDispensedAt() {
        return dispensedAt;
    }
}
