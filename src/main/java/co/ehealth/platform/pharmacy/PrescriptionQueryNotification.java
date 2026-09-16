package co.ehealth.platform.pharmacy;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "prescription_query_notifications")
public class PrescriptionQueryNotification {
    @Id @GeneratedValue private UUID id;
    @Column(name = "query_id", nullable = false) private UUID queryId;
    @Column(name = "recipient_user_id", nullable = false) private UUID recipientUserId;
    @Column(nullable = false, length = 40) private String type;
    @Column(nullable = false, length = 500) private String message;
    @Column(name = "created_at", nullable = false) private Instant createdAt;
    protected PrescriptionQueryNotification() { }
    public PrescriptionQueryNotification(UUID queryId, UUID recipientUserId, String type, String message, Instant createdAt) {
        this.queryId = queryId; this.recipientUserId = recipientUserId; this.type = type; this.message = message; this.createdAt = createdAt;
    }
    public UUID getId() { return id; } public UUID getQueryId() { return queryId; } public UUID getRecipientUserId() { return recipientUserId; }
    public String getType() { return type; } public String getMessage() { return message; } public Instant getCreatedAt() { return createdAt; }
}
