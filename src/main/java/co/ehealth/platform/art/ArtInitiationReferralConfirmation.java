package co.ehealth.platform.art;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "art_initiation_referral_confirmation",
        uniqueConstraints = @UniqueConstraint(name = "uq_art_initiation_referral_confirmation_visit_id", columnNames = "visit_id"))
public class ArtInitiationReferralConfirmation {
    @Id @GeneratedValue private UUID id;
    @Column(name = "visit_id", nullable = false) private UUID visitId;
    @Column(columnDefinition = "TEXT") private String notes;
    @Column(name = "created_by_user_id", nullable = false) private UUID createdByUserId;
    @Column(name = "updated_by_user_id", nullable = false) private UUID updatedByUserId;
    @Column(name = "created_at", nullable = false) private Instant createdAt;
    @Column(name = "updated_at", nullable = false) private Instant updatedAt;

    protected ArtInitiationReferralConfirmation() {}

    public ArtInitiationReferralConfirmation(UUID visitId, String notes, UUID userId, Instant now) {
        this.visitId = visitId;
        this.createdByUserId = userId;
        this.createdAt = now;
        update(notes, userId, now);
    }

    public void update(String notes, UUID userId, Instant now) {
        this.notes = notes == null || notes.isBlank() ? null : notes.trim();
        this.updatedByUserId = userId;
        this.updatedAt = now;
    }

    public UUID getId() { return id; }
    public UUID getVisitId() { return visitId; }
    public String getNotes() { return notes; }
    public UUID getUpdatedByUserId() { return updatedByUserId; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
}
