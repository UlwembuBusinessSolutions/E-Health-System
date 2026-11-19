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
@Table(name = "art_initiation_health_education",
        uniqueConstraints = @UniqueConstraint(name = "uq_art_initiation_health_education_visit_id", columnNames = "visit_id"))
public class ArtInitiationHealthEducation {
    @Id @GeneratedValue private UUID id;
    @Column(name = "visit_id", nullable = false) private UUID visitId;
    @Column(name = "condom_importance") private Boolean condomImportance;
    @Column(name = "healthy_lifestyle_diet") private Boolean healthyLifestyleDiet;
    @Column(name = "partner_testing") private Boolean partnerTesting;
    @Column(name = "hiv_status_disclosure") private Boolean hivStatusDisclosure;
    @Column(name = "adherence_compliance") private Boolean adherenceCompliance;
    @Column(name = "family_planning") private Boolean familyPlanning;
    @Column(name = "general_hiv_information") private Boolean generalHivInformation;
    @Column(name = "regular_pap_smear") private Boolean regularPapSmear;
    @Column(name = "medication_side_effects") private Boolean medicationSideEffects;
    @Column(name = "clinic_attendance_for_health_issues") private Boolean clinicAttendanceForHealthIssues;
    @Column(name = "herbal_traditional_medication_discussion") private Boolean herbalTraditionalMedicationDiscussion;
    @Column(name = "other_discussed") private Boolean otherDiscussed;
    @Column(name = "other_specify", columnDefinition = "TEXT") private String otherSpecify;
    @Column(name = "created_by_user_id", nullable = false) private UUID createdByUserId;
    @Column(name = "updated_by_user_id", nullable = false) private UUID updatedByUserId;
    @Column(name = "created_at", nullable = false) private Instant createdAt;
    @Column(name = "updated_at", nullable = false) private Instant updatedAt;

    protected ArtInitiationHealthEducation() {}

    public ArtInitiationHealthEducation(UUID visitId, UUID userId, Instant now) {
        this.visitId = visitId;
        this.createdByUserId = userId;
        this.createdAt = now;
        this.updatedByUserId = userId;
        this.updatedAt = now;
    }

    public void update(ArtInitiationHealthEducationController.SaveRequest request, UUID userId, Instant now) {
        this.condomImportance = request.condomImportance();
        this.healthyLifestyleDiet = request.healthyLifestyleDiet();
        this.partnerTesting = request.partnerTesting();
        this.hivStatusDisclosure = request.hivStatusDisclosure();
        this.adherenceCompliance = request.adherenceCompliance();
        this.familyPlanning = request.familyPlanning();
        this.generalHivInformation = request.generalHivInformation();
        this.regularPapSmear = request.regularPapSmear();
        this.medicationSideEffects = request.medicationSideEffects();
        this.clinicAttendanceForHealthIssues = request.clinicAttendanceForHealthIssues();
        this.herbalTraditionalMedicationDiscussion = request.herbalTraditionalMedicationDiscussion();
        this.otherDiscussed = request.otherDiscussed();
        this.otherSpecify = Boolean.TRUE.equals(request.otherDiscussed()) ? normalize(request.otherSpecify()) : null;
        this.updatedByUserId = userId;
        this.updatedAt = now;
    }

    private static String normalize(String value) { return value == null || value.isBlank() ? null : value.trim(); }
    public UUID getId() { return id; }
    public UUID getVisitId() { return visitId; }
    public Boolean getCondomImportance() { return condomImportance; }
    public Boolean getHealthyLifestyleDiet() { return healthyLifestyleDiet; }
    public Boolean getPartnerTesting() { return partnerTesting; }
    public Boolean getHivStatusDisclosure() { return hivStatusDisclosure; }
    public Boolean getAdherenceCompliance() { return adherenceCompliance; }
    public Boolean getFamilyPlanning() { return familyPlanning; }
    public Boolean getGeneralHivInformation() { return generalHivInformation; }
    public Boolean getRegularPapSmear() { return regularPapSmear; }
    public Boolean getMedicationSideEffects() { return medicationSideEffects; }
    public Boolean getClinicAttendanceForHealthIssues() { return clinicAttendanceForHealthIssues; }
    public Boolean getHerbalTraditionalMedicationDiscussion() { return herbalTraditionalMedicationDiscussion; }
    public Boolean getOtherDiscussed() { return otherDiscussed; }
    public String getOtherSpecify() { return otherSpecify; }
    public UUID getUpdatedByUserId() { return updatedByUserId; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
}
