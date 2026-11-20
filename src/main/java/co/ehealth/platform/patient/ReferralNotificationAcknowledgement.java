package co.ehealth.platform.patient;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "referral_notification_acknowledgements", schema = "control")
public class ReferralNotificationAcknowledgement {

    @Id
    @GeneratedValue
    private UUID id;

    @Column(name = "notification_id", nullable = false)
    private UUID notificationId;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(name = "acknowledged_at", nullable = false)
    private Instant acknowledgedAt;

    protected ReferralNotificationAcknowledgement() {
    }

    public ReferralNotificationAcknowledgement(UUID notificationId, UUID userId, Instant acknowledgedAt) {
        this.notificationId = notificationId;
        this.userId = userId;
        this.acknowledgedAt = acknowledgedAt;
    }

    public UUID getId() { return id; }
    public UUID getNotificationId() { return notificationId; }
    public UUID getUserId() { return userId; }
    public Instant getAcknowledgedAt() { return acknowledgedAt; }
}
