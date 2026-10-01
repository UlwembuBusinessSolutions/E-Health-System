package co.ehealth.platform.triage;

import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.EnumSet;
import java.util.Set;
import java.util.UUID;

// One triage/vitals capture for a Visit — deliberately linked to the visit,
// not the queue token (Docs/vitals-triage-plan.md §3's own why-note): a
// clinical observation is a fact about the visit, and a token can be
// missed/reactivated/reissued while the observations taken during that
// visit stay exactly what they were. Every row here is written once and
// never mutated after insert — see TriageAssessmentStatus for how a
// mistaken entry gets corrected without editing or deleting it, the same
// "don't destroy history" lesson the queue_tokens/queue_token_events split
// already established for this codebase.
//
// discriminators uses @ElementCollection rather than a comma list or a
// jsonb array: it's a genuine one-to-many relationship (an assessment can
// have several), and JPA already gives a properly normalized child table
// for exactly this shape without hand-writing a whole separate entity/
// repository pair for what's structurally just a set of enum values.
@Entity
@Table(name = "triage_assessments")
public class TriageAssessment {

    @Id
    @GeneratedValue
    private UUID id;

    @Column(name = "visit_id", nullable = false)
    private UUID visitId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private TriageAssessmentStatus status;

    @Column(name = "supersedes_assessment_id")
    private UUID supersedesAssessmentId;

    @Column(name = "correction_reason")
    private String correctionReason;

    @Column(name = "emergency_sign", nullable = false)
    private boolean emergencySign;

    @Column(name = "emergency_sign_note")
    private String emergencySignNote;

    @Enumerated(EnumType.STRING)
    @Column(name = "scoring_profile", nullable = false, length = 30)
    private ScoringProfile scoringProfile;

    @Column(name = "profile_manually_confirmed", nullable = false)
    private boolean profileManuallyConfirmed;

    @Column(name = "respiratory_rate")
    private Integer respiratoryRate;

    @Column(name = "heart_rate")
    private Integer heartRate;

    @Column(name = "systolic_bp")
    private Integer systolicBp;

    @Column(name = "diastolic_bp")
    private Integer diastolicBp;

    @Column(name = "temperature_celsius")
    private Double temperatureCelsius;

    @Column(name = "spo2_percent")
    private Integer spo2Percent;

    @Enumerated(EnumType.STRING)
    @Column(name = "oxygen_support", nullable = false, length = 20)
    private OxygenSupport oxygenSupport;

    @Column(name = "oxygen_device")
    private String oxygenDevice;

    @Column(name = "oxygen_flow_lpm")
    private Double oxygenFlowLpm;

    @Enumerated(EnumType.STRING)
    @Column(length = 20)
    private Avpu avpu;

    @Enumerated(EnumType.STRING)
    @Column(length = 30)
    private Mobility mobility;

    @Column(name = "pain_score")
    private Integer painScore;

    @Column(name = "pain_scale")
    private String painScale;

    @Column(name = "presenting_complaint")
    private String presentingComplaint;

    @Column(name = "out_of_range_confirmed", nullable = false)
    private boolean outOfRangeConfirmed;

    @Column(name = "validation_warnings")
    private String validationWarnings;

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "triage_assessment_discriminators", joinColumns = @JoinColumn(name = "assessment_id"))
    @Enumerated(EnumType.STRING)
    @Column(name = "discriminator", nullable = false, length = 40)
    private Set<TriageDiscriminator> discriminators = EnumSet.noneOf(TriageDiscriminator.class);

    @Column(name = "tews_score")
    private Integer tewsScore;

    @Column(name = "scoring_version", nullable = false, length = 30)
    private String scoringVersion;

    @Enumerated(EnumType.STRING)
    @Column(name = "calculated_colour", nullable = false, length = 10)
    private TriageColour calculatedColour;

    @Enumerated(EnumType.STRING)
    @Column(name = "final_colour", nullable = false, length = 10)
    private TriageColour finalColour;

    @Column(name = "override_reason")
    private String overrideReason;

    @Column(name = "overridden_by_user_id")
    private UUID overriddenByUserId;

    @Column(name = "captured_by_user_id", nullable = false)
    private UUID capturedByUserId;

    // When the measurements were actually taken, vs. when this row was
    // saved — usually the same instant for on-the-spot capture, but kept
    // distinct so a delayed/offline entry can honestly record when the
    // patient was actually assessed without pretending it happened at
    // save time.
    @Column(name = "observed_at", nullable = false)
    private Instant observedAt;

    @Column(name = "recorded_at", nullable = false)
    private Instant recordedAt;

    @Column(name = "idempotency_key", length = 100)
    private String idempotencyKey;

    @jakarta.persistence.Embedded
    private AdditionalObservations additionalObservations;

    public AdditionalObservations getAdditionalObservations() { return additionalObservations; }
    public void setAdditionalObservations(AdditionalObservations value) { this.additionalObservations = value; }

    protected TriageAssessment() {
    }

    public TriageAssessment(UUID visitId, boolean emergencySign, String emergencySignNote,
                             ScoringProfile scoringProfile, boolean profileManuallyConfirmed,
                             Integer respiratoryRate, Integer heartRate, Integer systolicBp, Integer diastolicBp,
                             Double temperatureCelsius, Integer spo2Percent, OxygenSupport oxygenSupport,
                             String oxygenDevice, Double oxygenFlowLpm, Avpu avpu, Mobility mobility,
                             Integer painScore, String painScale, String presentingComplaint,
                             boolean outOfRangeConfirmed, String validationWarnings,
                             Set<TriageDiscriminator> discriminators, Integer tewsScore, String scoringVersion,
                             TriageColour calculatedColour, TriageColour finalColour, UUID capturedByUserId,
                             Instant observedAt, Instant recordedAt, String idempotencyKey) {
        this.visitId = visitId;
        this.status = TriageAssessmentStatus.ACTIVE;
        this.emergencySign = emergencySign;
        this.emergencySignNote = emergencySignNote;
        this.scoringProfile = scoringProfile;
        this.profileManuallyConfirmed = profileManuallyConfirmed;
        this.respiratoryRate = respiratoryRate;
        this.heartRate = heartRate;
        this.systolicBp = systolicBp;
        this.diastolicBp = diastolicBp;
        this.temperatureCelsius = temperatureCelsius;
        this.spo2Percent = spo2Percent;
        this.oxygenSupport = oxygenSupport;
        this.oxygenDevice = oxygenDevice;
        this.oxygenFlowLpm = oxygenFlowLpm;
        this.avpu = avpu;
        this.mobility = mobility;
        this.painScore = painScore;
        this.painScale = painScale;
        this.presentingComplaint = presentingComplaint;
        this.outOfRangeConfirmed = outOfRangeConfirmed;
        this.validationWarnings = validationWarnings;
        // EnumSet.copyOf() throws IllegalArgumentException on an EMPTY
        // collection, not just a null one (it can't infer the enum type
        // from zero elements) — confirmed by testing: the very first
        // capture with no discriminators selected 500'd here before this
        // guard also checked isEmpty(), not just null.
        this.discriminators = (discriminators == null || discriminators.isEmpty())
                ? EnumSet.noneOf(TriageDiscriminator.class) : EnumSet.copyOf(discriminators);
        this.tewsScore = tewsScore;
        this.scoringVersion = scoringVersion;
        this.calculatedColour = calculatedColour;
        this.finalColour = finalColour;
        this.capturedByUserId = capturedByUserId;
        this.observedAt = observedAt;
        this.recordedAt = recordedAt;
        this.idempotencyKey = idempotencyKey;
    }

    // A senior clinician disagreeing with the calculated colour — kept
    // distinct from the calculated result rather than overwriting it, so
    // "what the algorithm said" and "what a human decided" are both always
    // visible on the same row, never one clobbering the other.
    public void override(TriageColour finalColour, String overrideReason, UUID overriddenByUserId) {
        this.finalColour = finalColour;
        this.overrideReason = overrideReason;
        this.overriddenByUserId = overriddenByUserId;
    }

    public void markSuperseded() {
        this.status = TriageAssessmentStatus.SUPERSEDED;
    }

    public void markEnteredInError(String reason) {
        this.status = TriageAssessmentStatus.ENTERED_IN_ERROR;
        this.correctionReason = reason;
    }

    public void linkSupersedes(UUID supersedesAssessmentId) {
        this.supersedesAssessmentId = supersedesAssessmentId;
    }

    public UUID getId() {
        return id;
    }

    public UUID getVisitId() {
        return visitId;
    }

    public TriageAssessmentStatus getStatus() {
        return status;
    }

    public UUID getSupersedesAssessmentId() {
        return supersedesAssessmentId;
    }

    public String getCorrectionReason() {
        return correctionReason;
    }

    public boolean isEmergencySign() {
        return emergencySign;
    }

    public String getEmergencySignNote() {
        return emergencySignNote;
    }

    public ScoringProfile getScoringProfile() {
        return scoringProfile;
    }

    public boolean isProfileManuallyConfirmed() {
        return profileManuallyConfirmed;
    }

    public Integer getRespiratoryRate() {
        return respiratoryRate;
    }

    public Integer getHeartRate() {
        return heartRate;
    }

    public Integer getSystolicBp() {
        return systolicBp;
    }

    public Integer getDiastolicBp() {
        return diastolicBp;
    }

    public Double getTemperatureCelsius() {
        return temperatureCelsius;
    }

    public Integer getSpo2Percent() {
        return spo2Percent;
    }

    public OxygenSupport getOxygenSupport() {
        return oxygenSupport;
    }

    public String getOxygenDevice() {
        return oxygenDevice;
    }

    public Double getOxygenFlowLpm() {
        return oxygenFlowLpm;
    }

    public Avpu getAvpu() {
        return avpu;
    }

    public Mobility getMobility() {
        return mobility;
    }

    public Integer getPainScore() {
        return painScore;
    }

    public String getPainScale() {
        return painScale;
    }

    public String getPresentingComplaint() {
        return presentingComplaint;
    }

    public boolean isOutOfRangeConfirmed() {
        return outOfRangeConfirmed;
    }

    public String getValidationWarnings() {
        return validationWarnings;
    }

    public Set<TriageDiscriminator> getDiscriminators() {
        return discriminators;
    }

    public Integer getTewsScore() {
        return tewsScore;
    }

    public String getScoringVersion() {
        return scoringVersion;
    }

    public TriageColour getCalculatedColour() {
        return calculatedColour;
    }

    public TriageColour getFinalColour() {
        return finalColour;
    }

    public String getOverrideReason() {
        return overrideReason;
    }

    public UUID getOverriddenByUserId() {
        return overriddenByUserId;
    }

    public UUID getCapturedByUserId() {
        return capturedByUserId;
    }

    public Instant getObservedAt() {
        return observedAt;
    }

    public Instant getRecordedAt() {
        return recordedAt;
    }

    public String getIdempotencyKey() {
        return idempotencyKey;
    }
}
