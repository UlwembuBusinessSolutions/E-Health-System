package co.ehealth.platform.patient;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "patient_referrals")
public class PatientReferral {

    @Id
    @GeneratedValue
    private UUID id;

    @Column(name = "patient_id", nullable = false)
    private UUID patientId;

    @Enumerated(EnumType.STRING)
    @Column(name = "referral_type", nullable = false, length = 20)
    private PatientReferralType referralType;

    @Column(name = "destination_facility_id")
    private UUID destinationFacilityId;

    @Column(name = "institution_name", length = 200)
    private String institutionName;

    @Column(name = "contact_person", length = 160)
    private String contactPerson;

    @Column(name = "telephone_number", length = 30)
    private String telephoneNumber;

    @Column(name = "fax_number", length = 30)
    private String faxNumber;

    @Column(name = "referral_date", nullable = false)
    private LocalDate referralDate;

    @Column(name = "reason")
    private String reason;

    @Column(name = "clinical_summary")
    private String clinicalSummary;

    @Column(name = "required_medication")
    private String requiredMedication;

    @Column(name = "medication_instructions")
    private String medicationInstructions;

    @Column(name = "additional_notes")
    private String additionalNotes;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private PatientReferralStatus status;

    @Column(name = "initiated_by_user_id", nullable = false)
    private UUID initiatedByUserId;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @Column(name = "submitted_at")
    private Instant submittedAt;

    @Column(name = "accepted_at")
    private Instant acceptedAt;

    @Column(name = "completed_at")
    private Instant completedAt;

    @Column(name = "cancelled_at")
    private Instant cancelledAt;

    protected PatientReferral() {
    }

    public PatientReferral(UUID patientId, PatientReferralType referralType, UUID destinationFacilityId,
                           String institutionName, String contactPerson, String telephoneNumber, String faxNumber,
                           LocalDate referralDate, String reason, String clinicalSummary, String requiredMedication,
                           String medicationInstructions, String additionalNotes, UUID initiatedByUserId,
                           Instant now) {
        this.patientId = patientId;
        this.referralType = referralType;
        this.destinationFacilityId = destinationFacilityId;
        this.institutionName = institutionName;
        this.contactPerson = contactPerson;
        this.telephoneNumber = telephoneNumber;
        this.faxNumber = faxNumber;
        this.referralDate = referralDate;
        this.reason = reason;
        this.clinicalSummary = clinicalSummary;
        this.requiredMedication = requiredMedication;
        this.medicationInstructions = medicationInstructions;
        this.additionalNotes = additionalNotes;
        this.initiatedByUserId = initiatedByUserId;
        this.status = PatientReferralStatus.DRAFT;
        this.createdAt = now;
        this.updatedAt = now;
    }

    public void update(PatientReferralType referralType, UUID destinationFacilityId, String institutionName,
                       String contactPerson, String telephoneNumber, String faxNumber, LocalDate referralDate,
                       String reason, String clinicalSummary, String requiredMedication,
                       String medicationInstructions, String additionalNotes, Instant now) {
        this.referralType = referralType;
        this.destinationFacilityId = destinationFacilityId;
        this.institutionName = institutionName;
        this.contactPerson = contactPerson;
        this.telephoneNumber = telephoneNumber;
        this.faxNumber = faxNumber;
        this.referralDate = referralDate;
        this.reason = reason;
        this.clinicalSummary = clinicalSummary;
        this.requiredMedication = requiredMedication;
        this.medicationInstructions = medicationInstructions;
        this.additionalNotes = additionalNotes;
        this.updatedAt = now;
    }

    public void changeStatus(PatientReferralStatus next, Instant now) {
        this.status = next;
        this.updatedAt = now;
        switch (next) {
            case SUBMITTED -> this.submittedAt = now;
            case ACCEPTED -> this.acceptedAt = now;
            case COMPLETED -> this.completedAt = now;
            case CANCELLED -> this.cancelledAt = now;
            default -> { }
        }
    }

    public UUID getId() { return id; }
    public UUID getPatientId() { return patientId; }
    public PatientReferralType getReferralType() { return referralType; }
    public UUID getDestinationFacilityId() { return destinationFacilityId; }
    public String getInstitutionName() { return institutionName; }
    public String getContactPerson() { return contactPerson; }
    public String getTelephoneNumber() { return telephoneNumber; }
    public String getFaxNumber() { return faxNumber; }
    public LocalDate getReferralDate() { return referralDate; }
    public String getReason() { return reason; }
    public String getClinicalSummary() { return clinicalSummary; }
    public String getRequiredMedication() { return requiredMedication; }
    public String getMedicationInstructions() { return medicationInstructions; }
    public String getAdditionalNotes() { return additionalNotes; }
    public PatientReferralStatus getStatus() { return status; }
    public UUID getInitiatedByUserId() { return initiatedByUserId; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public Instant getSubmittedAt() { return submittedAt; }
    public Instant getAcceptedAt() { return acceptedAt; }
    public Instant getCompletedAt() { return completedAt; }
    public Instant getCancelledAt() { return cancelledAt; }
}
