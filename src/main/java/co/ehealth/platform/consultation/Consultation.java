package co.ehealth.platform.consultation;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

// One consultation record for a Visit — deliberately linked to the visit,
// the same "a clinical fact belongs to the visit, not the queue token"
// reasoning TriageAssessment already established. Never duplicates
// presenting complaint or vital signs: those already live on
// triage_assessments for this visit_id and are read from there, not
// re-captured here (Docs/vitals-to-consultation-pharmacy-closure-brainstorm.md
// §5's "latest vitals visible in the consultation workspace," not a second
// copy of them).
//
// Unlike every other clinical record in this codebase (triage_assessments,
// prescriptions), a row here IS mutated in place — but only while DRAFT.
// Once SIGNED it becomes exactly as write-once as those: a correction never
// edits a signed row, it creates a new one via amend() and marks this one
// SUPERSEDED, the same append-only lesson TriageAssessmentStatus applied to
// vitals, applied here to the next step in the same encounter.
@Entity
@Table(name = "consultations")
public class Consultation {

    @Id
    @GeneratedValue
    private UUID id;

    @Column(name = "visit_id", nullable = false)
    private UUID visitId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private ConsultationStatus status;

    @Column(name = "supersedes_consultation_id")
    private UUID supersedesConsultationId;

    // Doubles as the entered-in-error reason and the amendment reason —
    // the same dual-purpose role TriageAssessment.correctionReason plays,
    // renamed to this entity's own vocabulary.
    @Column(name = "amendment_reason")
    private String amendmentReason;

    @Column(name = "author_user_id", nullable = false)
    private UUID authorUserId;

    @Column(name = "signed_by_user_id")
    private UUID signedByUserId;

    @Column(name = "signed_at")
    private Instant signedAt;

    @Column(name = "relevant_history")
    private String relevantHistory;

    @Column(name = "current_medications")
    private String currentMedications;

    @Enumerated(EnumType.STRING)
    @Column(name = "allergy_status", nullable = false, length = 20)
    private AllergyStatus allergyStatus;

    @Column(name = "allergy_detail")
    private String allergyDetail;

    @Column(name = "examination_notes")
    private String examinationNotes;

    @Column(name = "investigations_notes")
    private String investigationsNotes;

    @Column(name = "treatment_plan")
    private String treatmentPlan;

    @Enumerated(EnumType.STRING)
    @Column(length = 30)
    private ConsultationOutcome outcome;

    @Column(name = "outcome_notes")
    private String outcomeNotes;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected Consultation() {
    }

    // A fresh draft — everything past the author/timestamps starts empty
    // and is filled in via updateFields()/addDiagnosis() while still DRAFT.
    public Consultation(UUID visitId, UUID authorUserId, Instant now) {
        this.visitId = visitId;
        this.status = ConsultationStatus.DRAFT;
        this.authorUserId = authorUserId;
        this.allergyStatus = AllergyStatus.UNKNOWN;
        this.createdAt = now;
        this.updatedAt = now;
    }

    // Only ever called while status == DRAFT — ConsultationService enforces
    // that, not this method, same division of labour as the rest of this
    // codebase's entities (the service decides whether a transition is
    // allowed; the entity just performs it).
    public void updateFields(String relevantHistory, String currentMedications, AllergyStatus allergyStatus,
                              String allergyDetail, String examinationNotes, String investigationsNotes,
                              String treatmentPlan, Instant now) {
        this.relevantHistory = relevantHistory;
        this.currentMedications = currentMedications;
        this.allergyStatus = allergyStatus;
        this.allergyDetail = allergyDetail;
        this.examinationNotes = examinationNotes;
        this.investigationsNotes = investigationsNotes;
        this.treatmentPlan = treatmentPlan;
        this.updatedAt = now;
    }

    public void touchUpdatedAt(Instant now) {
        this.updatedAt = now;
    }

    public void sign(ConsultationOutcome outcome, String outcomeNotes, UUID signedByUserId, Instant now) {
        this.status = ConsultationStatus.SIGNED;
        this.outcome = outcome;
        this.outcomeNotes = outcomeNotes;
        this.signedByUserId = signedByUserId;
        this.signedAt = now;
        this.updatedAt = now;
    }

    public void markSuperseded() {
        this.status = ConsultationStatus.SUPERSEDED;
    }

    // A pure mistake — wrong patient, fat-fingered entry — with nothing to
    // replace it, unlike amend() which corrects by replacing. Still never
    // deletes the row.
    public void markEnteredInError(String reason) {
        this.status = ConsultationStatus.ENTERED_IN_ERROR;
        this.amendmentReason = reason;
    }

    public void linkSupersedes(UUID supersedesConsultationId, String amendmentReason) {
        this.supersedesConsultationId = supersedesConsultationId;
        this.amendmentReason = amendmentReason;
    }

    public UUID getId() {
        return id;
    }

    public UUID getVisitId() {
        return visitId;
    }

    public ConsultationStatus getStatus() {
        return status;
    }

    public UUID getSupersedesConsultationId() {
        return supersedesConsultationId;
    }

    public String getAmendmentReason() {
        return amendmentReason;
    }

    public UUID getAuthorUserId() {
        return authorUserId;
    }

    public UUID getSignedByUserId() {
        return signedByUserId;
    }

    public Instant getSignedAt() {
        return signedAt;
    }

    public String getRelevantHistory() {
        return relevantHistory;
    }

    public String getCurrentMedications() {
        return currentMedications;
    }

    public AllergyStatus getAllergyStatus() {
        return allergyStatus;
    }

    public String getAllergyDetail() {
        return allergyDetail;
    }

    public String getExaminationNotes() {
        return examinationNotes;
    }

    public String getInvestigationsNotes() {
        return investigationsNotes;
    }

    public String getTreatmentPlan() {
        return treatmentPlan;
    }

    public ConsultationOutcome getOutcome() {
        return outcome;
    }

    public String getOutcomeNotes() {
        return outcomeNotes;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }
}
