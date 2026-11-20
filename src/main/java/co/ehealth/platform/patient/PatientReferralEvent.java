package co.ehealth.platform.patient;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "patient_referral_events")
public class PatientReferralEvent {

    @Id
    @GeneratedValue
    private UUID id;

    @Column(name = "referral_id", nullable = false)
    private UUID referralId;

    @Enumerated(EnumType.STRING)
    @Column(name = "from_status", length = 20)
    private PatientReferralStatus fromStatus;

    @Enumerated(EnumType.STRING)
    @Column(name = "to_status", nullable = false, length = 20)
    private PatientReferralStatus toStatus;

    @Column(name = "actor_user_id", nullable = false)
    private UUID actorUserId;

    @Column(length = 500)
    private String note;

    @Column(name = "occurred_at", nullable = false)
    private Instant occurredAt;

    protected PatientReferralEvent() {
    }

    public PatientReferralEvent(UUID referralId, PatientReferralStatus fromStatus, PatientReferralStatus toStatus,
                                UUID actorUserId, String note, Instant occurredAt) {
        this.referralId = referralId;
        this.fromStatus = fromStatus;
        this.toStatus = toStatus;
        this.actorUserId = actorUserId;
        this.note = note;
        this.occurredAt = occurredAt;
    }

    public UUID getId() { return id; }
    public UUID getReferralId() { return referralId; }
    public PatientReferralStatus getFromStatus() { return fromStatus; }
    public PatientReferralStatus getToStatus() { return toStatus; }
    public UUID getActorUserId() { return actorUserId; }
    public String getNote() { return note; }
    public Instant getOccurredAt() { return occurredAt; }
}
