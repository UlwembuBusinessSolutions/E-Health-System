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
@Table(name = "art_initiation_jaccol_examination",
        uniqueConstraints = @UniqueConstraint(name = "uq_art_initiation_jaccol_examination_visit_id", columnNames = "visit_id"))
public class ArtInitiationJaccolExamination {
    @Id
    @GeneratedValue
    private UUID id;

    @Column(name = "visit_id", nullable = false)
    private UUID visitId;

    @Column(name = "j_status", length = 8) private String jStatus;
    @Column(name = "j_comment", columnDefinition = "TEXT") private String jComment;
    @Column(name = "a_status", length = 8) private String aStatus;
    @Column(name = "a_comment", columnDefinition = "TEXT") private String aComment;
    @Column(name = "c1_status", length = 8) private String c1Status;
    @Column(name = "c1_comment", columnDefinition = "TEXT") private String c1Comment;
    @Column(name = "c2_status", length = 8) private String c2Status;
    @Column(name = "c2_comment", columnDefinition = "TEXT") private String c2Comment;
    @Column(name = "o_status", length = 8) private String oStatus;
    @Column(name = "o_comment", columnDefinition = "TEXT") private String oComment;
    @Column(name = "l_status", length = 8) private String lStatus;
    @Column(name = "l_comment", columnDefinition = "TEXT") private String lComment;
    @Column(name = "other_comment", columnDefinition = "TEXT") private String otherComment;
    @Column(columnDefinition = "TEXT") private String notes;
    @Column(name = "created_by_user_id", nullable = false) private UUID createdByUserId;
    @Column(name = "updated_by_user_id", nullable = false) private UUID updatedByUserId;
    @Column(name = "created_at", nullable = false) private Instant createdAt;
    @Column(name = "updated_at", nullable = false) private Instant updatedAt;

    protected ArtInitiationJaccolExamination() {}

    public ArtInitiationJaccolExamination(UUID visitId, UUID userId, Instant now) {
        this.visitId = visitId;
        this.createdByUserId = userId;
        this.createdAt = now;
        this.updatedByUserId = userId;
        this.updatedAt = now;
    }

    public void update(ArtInitiationJaccolExaminationController.SaveRequest request, UUID userId, Instant now) {
        this.jStatus = status(request.jStatus());
        this.jComment = comment(request.jStatus(), request.jComment());
        this.aStatus = status(request.aStatus());
        this.aComment = comment(request.aStatus(), request.aComment());
        this.c1Status = status(request.c1Status());
        this.c1Comment = comment(request.c1Status(), request.c1Comment());
        this.c2Status = status(request.c2Status());
        this.c2Comment = comment(request.c2Status(), request.c2Comment());
        this.oStatus = status(request.oStatus());
        this.oComment = comment(request.oStatus(), request.oComment());
        this.lStatus = status(request.lStatus());
        this.lComment = comment(request.lStatus(), request.lComment());
        this.otherComment = normalize(request.otherComment());
        this.notes = normalize(request.notes());
        this.updatedByUserId = userId;
        this.updatedAt = now;
    }

    private static String status(String value) {
        if (value == null) return null;
        String normalized = value.trim().toUpperCase();
        if (!normalized.equals("PRESENT") && !normalized.equals("ABSENT")) {
            throw new InvalidArtInitiationJaccolExaminationException("JACCOL answers must be Present or Absent.");
        }
        return normalized;
    }

    private static String comment(String status, String comment) {
        return "PRESENT".equalsIgnoreCase(status) ? normalize(comment) : null;
    }

    private static String normalize(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    public UUID getId() { return id; }
    public UUID getVisitId() { return visitId; }
    public String getJStatus() { return jStatus; }
    public String getJComment() { return jComment; }
    public String getAStatus() { return aStatus; }
    public String getAComment() { return aComment; }
    public String getC1Status() { return c1Status; }
    public String getC1Comment() { return c1Comment; }
    public String getC2Status() { return c2Status; }
    public String getC2Comment() { return c2Comment; }
    public String getOStatus() { return oStatus; }
    public String getOComment() { return oComment; }
    public String getLStatus() { return lStatus; }
    public String getLComment() { return lComment; }
    public String getOtherComment() { return otherComment; }
    public String getNotes() { return notes; }
    public UUID getUpdatedByUserId() { return updatedByUserId; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
}
