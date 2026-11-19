package co.ehealth.platform.art;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "art_eyes_examinations",
        uniqueConstraints = @UniqueConstraint(name = "uq_art_eyes_examinations_visit_id", columnNames = "visit_id"))
public class ArtEyesExamination {

    @Id
    @GeneratedValue
    private UUID id;

    @Column(name = "visit_id", nullable = false)
    private UUID visitId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private EyeExaminationResult result;

    @Column(columnDefinition = "TEXT")
    private String comments;

    @Column(name = "recorded_by_user_id", nullable = false)
    private UUID recordedByUserId;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected ArtEyesExamination() {
    }

    public ArtEyesExamination(UUID visitId, EyeExaminationResult result, String comments,
            UUID staffUserId, Instant now) {
        this.visitId = visitId;
        this.result = result;
        this.comments = comments;
        this.recordedByUserId = staffUserId;
        this.createdAt = now;
        this.updatedAt = now;
    }

    public void update(EyeExaminationResult result, String comments, UUID staffUserId, Instant now) {
        this.result = result;
        this.comments = comments;
        this.recordedByUserId = staffUserId;
        this.updatedAt = now;
    }

    public UUID getId() {
        return id;
    }

    public UUID getVisitId() {
        return visitId;
    }

    public EyeExaminationResult getResult() {
        return result;
    }

    public String getComments() {
        return comments;
    }

    public UUID getRecordedByUserId() {
        return recordedByUserId;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }
}
