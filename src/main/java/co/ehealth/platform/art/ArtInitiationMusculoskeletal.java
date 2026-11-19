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
@Table(name = "art_initiation_musculoskeletal",
        uniqueConstraints = @UniqueConstraint(name = "uq_art_initiation_musculoskeletal_visit_id", columnNames = "visit_id"))
public class ArtInitiationMusculoskeletal {
    @Id
    @GeneratedValue
    private UUID id;

    @Column(name = "visit_id", nullable = false)
    private UUID visitId;

    @Column(length = 10)
    private String finding;

    @Column(columnDefinition = "TEXT")
    private String comment;

    @Column(name = "created_by_user_id", nullable = false)
    private UUID createdByUserId;

    @Column(name = "updated_by_user_id", nullable = false)
    private UUID updatedByUserId;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected ArtInitiationMusculoskeletal() {}

    public ArtInitiationMusculoskeletal(UUID visitId, UUID userId, Instant now) {
        this.visitId = visitId;
        this.createdByUserId = userId;
        this.createdAt = now;
        this.updatedByUserId = userId;
        this.updatedAt = now;
    }

    public void update(String finding, String comment, UUID userId, Instant now) {
        if (finding != null && !finding.equals("NORMAL") && !finding.equals("ABNORMAL")) {
            throw new InvalidArtInitiationMusculoskeletalException("Choose Normal or Abnormal.");
        }
        this.finding = finding;
        this.comment = finding == null || comment == null || comment.isBlank() ? null : comment.trim();
        this.updatedByUserId = userId;
        this.updatedAt = now;
    }

    public UUID getId() { return id; }
    public UUID getVisitId() { return visitId; }
    public String getFinding() { return finding; }
    public String getComment() { return comment; }
    public UUID getUpdatedByUserId() { return updatedByUserId; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
}
