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
@Table(name = "art_initiation_central_nervous_system",
        uniqueConstraints = @UniqueConstraint(name = "uq_art_initiation_central_nervous_system_visit_id", columnNames = "visit_id"))
public class ArtInitiationCentralNervousSystem {
    @Id
    @GeneratedValue
    private UUID id;

    @Column(name = "visit_id", nullable = false)
    private UUID visitId;

    @Column(length = 10)
    private String finding;

    @Column(name = "normal_comment", columnDefinition = "TEXT")
    private String normalComment;

    @Column(name = "abnormal_comment", columnDefinition = "TEXT")
    private String abnormalComment;

    @Column(name = "created_by_user_id", nullable = false)
    private UUID createdByUserId;

    @Column(name = "updated_by_user_id", nullable = false)
    private UUID updatedByUserId;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected ArtInitiationCentralNervousSystem() {}

    public ArtInitiationCentralNervousSystem(UUID visitId, UUID userId, Instant now) {
        this.visitId = visitId;
        this.createdByUserId = userId;
        this.createdAt = now;
        this.updatedByUserId = userId;
        this.updatedAt = now;
    }

    public void update(String finding, String normalComment, String abnormalComment, UUID userId, Instant now) {
        if (finding != null && !finding.equals("NORMAL") && !finding.equals("ABNORMAL")) {
            throw new InvalidArtInitiationCentralNervousSystemException("Choose Normal or Abnormal.");
        }
        this.finding = finding;
        this.normalComment = "NORMAL".equals(finding) ? normalize(normalComment) : null;
        this.abnormalComment = "ABNORMAL".equals(finding) ? normalize(abnormalComment) : null;
        this.updatedByUserId = userId;
        this.updatedAt = now;
    }

    private static String normalize(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    public UUID getId() { return id; }
    public UUID getVisitId() { return visitId; }
    public String getFinding() { return finding; }
    public String getNormalComment() { return normalComment; }
    public String getAbnormalComment() { return abnormalComment; }
    public UUID getUpdatedByUserId() { return updatedByUserId; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
}
