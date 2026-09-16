package co.ehealth.platform.pharmacy;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "prescription_decline_notifications")
public class PrescriptionDeclineNotification {
    @Id @GeneratedValue private UUID id;
    @Column(name = "decline_id", nullable = false) private UUID declineId;
    @Column(name = "prescription_id", nullable = false) private UUID prescriptionId;
    @Column(name = "recipient_user_id", nullable = false) private UUID recipientUserId;
    @Column(name = "created_at", nullable = false) private Instant createdAt;
    protected PrescriptionDeclineNotification() { }
    public PrescriptionDeclineNotification(UUID declineId, UUID prescriptionId, UUID recipientUserId, Instant createdAt) {
        this.declineId = declineId; this.prescriptionId = prescriptionId; this.recipientUserId = recipientUserId; this.createdAt = createdAt;
    }
    public UUID getId() { return id; }
    public UUID getDeclineId() { return declineId; }
    public UUID getPrescriptionId() { return prescriptionId; }
    public UUID getRecipientUserId() { return recipientUserId; }
    public Instant getCreatedAt() { return createdAt; }
}
