package co.ehealth.platform.pharmacy;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

// One row per prescription ITEM currently or previously out of stock —
// mirrors DispensingRecord (prescriptionItemId unique), but unlike that one
// this is NOT a terminal event: PrescriptionService.markItemOutOfStock()
// upserts this row (updating note/markedAt) rather than only ever inserting
// once, since the same item can be re-flagged while pharmacy waits for
// restock. note is optional free text (which item, expected restock date).
@Entity
@Table(name = "prescription_out_of_stock_records")
public class PrescriptionOutOfStockRecord {

    @Id
    @GeneratedValue
    private UUID id;

    @Column(name = "prescription_item_id", nullable = false, unique = true)
    private UUID prescriptionItemId;

    @Column(name = "marked_by_user_id", nullable = false)
    private UUID markedByUserId;

    @Column(name = "marked_at", nullable = false)
    private Instant markedAt;

    @Column(length = 500)
    private String note;

    protected PrescriptionOutOfStockRecord() {
    }

    public PrescriptionOutOfStockRecord(UUID prescriptionItemId, UUID markedByUserId, Instant markedAt, String note) {
        this.prescriptionItemId = prescriptionItemId;
        this.markedByUserId = markedByUserId;
        this.markedAt = markedAt;
        this.note = note;
    }

    // PrescriptionService.markItemOutOfStock()'s upsert path — re-flagging
    // the same item updates who/when/why rather than erroring.
    public void update(UUID markedByUserId, Instant markedAt, String note) {
        this.markedByUserId = markedByUserId;
        this.markedAt = markedAt;
        this.note = note;
    }

    public UUID getId() {
        return id;
    }

    public UUID getPrescriptionItemId() {
        return prescriptionItemId;
    }

    public UUID getMarkedByUserId() {
        return markedByUserId;
    }

    public Instant getMarkedAt() {
        return markedAt;
    }

    public String getNote() {
        return note;
    }
}
