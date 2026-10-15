package co.ehealth.platform.pharmacy;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

// One row per dispensed prescription ITEM — prescriptionItemId is unique
// because once dispensed, an item is terminal and can never be dispensed a
// second time (PrescriptionItem's own why-note).
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

    @Column(name = "duty_entry_id")
    private UUID dutyEntryId;

    @Column(name = "prescriber_dispensed", nullable = false)
    private boolean prescriberDispensed;

    @Column(name = "no_dispenser_on_duty", nullable = false)
    private boolean noDispenserOnDuty;

    void setDutyEntryId(UUID dutyEntryId) { this.dutyEntryId = dutyEntryId; }

    protected DispensingRecord() {
    }

    public DispensingRecord(UUID prescriptionItemId, UUID dispensedByUserId, Instant dispensedAt) {
        this(prescriptionItemId, dispensedByUserId, dispensedAt, false, false, null);
    }

    public DispensingRecord(UUID prescriptionItemId, UUID dispensedByUserId, Instant dispensedAt,
                            boolean prescriberDispensed, boolean noDispenserOnDuty, UUID dutyEntryId) {
        this.prescriptionItemId = prescriptionItemId;
        this.dispensedByUserId = dispensedByUserId;
        this.dispensedAt = dispensedAt;
        this.prescriberDispensed = prescriberDispensed;
        this.noDispenserOnDuty = noDispenserOnDuty;
        this.dutyEntryId = dutyEntryId;
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

    public UUID getDutyEntryId() {
        return dutyEntryId;
    }

    public boolean isPrescriberDispensed() {
        return prescriberDispensed;
    }

    public boolean isNoDispenserOnDuty() {
        return noDispenserOnDuty;
    }
}
