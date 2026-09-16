package co.ehealth.platform.pharmacy;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

// A pharmacy-to-prescriber query about a specific prescription — "something
// else" that isn't a stock or dispensing action (a dosage concern, missing
// information, anything that needs the prescriber's own judgment). Always
// paired with a real email to the prescriber (PrescriptionService.
// sendPrescriberMessage() -> EmailService.sendPrescriberQueryEmail()); this
// row is the durable record of that the pharmacy's own history can show,
// independent of whether the email itself is ever opened.
@Entity
@Table(name = "prescriber_messages")
public class PrescriberMessage {

    @Id
    @GeneratedValue
    private UUID id;

    @Column(name = "prescription_id", nullable = false)
    private UUID prescriptionId;

    @Column(name = "sender_user_id", nullable = false)
    private UUID senderUserId;

    @Column(nullable = false, length = 2000)
    private String message;

    @Column(name = "sent_at", nullable = false)
    private Instant sentAt;

    protected PrescriberMessage() {
    }

    public PrescriberMessage(UUID prescriptionId, UUID senderUserId, String message, Instant sentAt) {
        this.prescriptionId = prescriptionId;
        this.senderUserId = senderUserId;
        this.message = message;
        this.sentAt = sentAt;
    }

    public UUID getId() {
        return id;
    }

    public UUID getPrescriptionId() {
        return prescriptionId;
    }

    public UUID getSenderUserId() {
        return senderUserId;
    }

    public String getMessage() {
        return message;
    }

    public Instant getSentAt() {
        return sentAt;
    }
}
