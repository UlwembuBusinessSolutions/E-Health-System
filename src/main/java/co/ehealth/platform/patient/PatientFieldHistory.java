package co.ehealth.platform.patient;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

// PREG-US-016 AC1's own append-only history — one row per field a
// PatientService.update() call actually changed, never mutated afterward.
// patientId is a plain column, not a @ManyToOne, same lighter-weight style
// every other patient-linked record in this module already uses.
@Entity
@Table(name = "patient_field_history")
public class PatientFieldHistory {

    @Id
    @GeneratedValue
    private UUID id;

    @Column(name = "patient_id", nullable = false)
    private UUID patientId;

    @Column(name = "field_name", nullable = false, length = 50)
    private String fieldName;

    @Column(name = "old_value", columnDefinition = "TEXT")
    private String oldValue;

    @Column(name = "new_value", columnDefinition = "TEXT")
    private String newValue;

    // NOT NULL at the schema level (V18) — PatientController.UpdatePatientRequest
    // requires it on every update call, not just ones touching a
    // clinically-significant field (PREG-US-016 AC3's own literal scope);
    // always capturing it is a simpler, strictly-more-complete superset.
    @Column(nullable = false, columnDefinition = "TEXT")
    private String reason;

    @Column(name = "changed_by_user_id")
    private UUID changedByUserId;

    @Column(name = "changed_at", nullable = false, updatable = false)
    private Instant changedAt;

    protected PatientFieldHistory() {
    }

    public PatientFieldHistory(UUID patientId, String fieldName, String oldValue, String newValue, String reason,
                                UUID changedByUserId, Instant changedAt) {
        this.patientId = patientId;
        this.fieldName = fieldName;
        this.oldValue = oldValue;
        this.newValue = newValue;
        this.reason = reason;
        this.changedByUserId = changedByUserId;
        this.changedAt = changedAt;
    }

    public UUID getId() {
        return id;
    }

    public UUID getPatientId() {
        return patientId;
    }

    public String getFieldName() {
        return fieldName;
    }

    public String getOldValue() {
        return oldValue;
    }

    public String getNewValue() {
        return newValue;
    }

    public String getReason() {
        return reason;
    }

    public UUID getChangedByUserId() {
        return changedByUserId;
    }

    public Instant getChangedAt() {
        return changedAt;
    }
}
