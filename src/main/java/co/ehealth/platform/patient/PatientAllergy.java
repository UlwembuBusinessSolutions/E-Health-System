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

// One recorded allergy on a patient's medical profile. patientId is a plain column, not a @ManyToOne,
// same lighter-weight style PatientGuardian and PatientDocument use. Never deleted — see deactivate().
@Entity
@Table(name = "patient_allergies")
public class PatientAllergy {

    @Id
    @GeneratedValue
    private UUID id;

    @Column(name = "patient_id", nullable = false, updatable = false)
    private UUID patientId;

    // An ATC code for a medication allergy; an optional reference code (e.g. a SNOMED code) otherwise.
    @Column(name = "allergy_code", length = 20)
    private String allergyCode;

    @Column(name = "catalog_product_id")
    private UUID catalogProductId;

    @Column(name = "allergy_name", nullable = false, length = 200)
    private String allergyName;

    @Enumerated(EnumType.STRING)
    @Column(name = "allergen_type", nullable = false, length = 20)
    private AllergenType allergenType;

    @Column(nullable = false, length = 500)
    private String reaction;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private AllergySeverity severity;

    @Column(name = "date_identified", nullable = false)
    private LocalDate dateIdentified;

    @Column(name = "clinical_notes")
    private String clinicalNotes;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private AllergyRecordStatus status = AllergyRecordStatus.ACTIVE;

    @Column(name = "inactive_reason", length = 500)
    private String inactiveReason;

    @Column(name = "inactivated_at")
    private Instant inactivatedAt;

    @Column(name = "inactivated_by_user_id")
    private UUID inactivatedByUserId;

    @Column(name = "created_by_user_id")
    private UUID createdByUserId;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_by_user_id")
    private UUID updatedByUserId;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected PatientAllergy() {
    }

    public PatientAllergy(UUID patientId, String allergyCode, UUID catalogProductId, String allergyName, AllergenType allergenType,
                          String reaction, AllergySeverity severity, LocalDate dateIdentified, String clinicalNotes,
                          UUID createdByUserId, Instant now) {
        this.patientId = patientId;
        this.allergyCode = allergyCode;
        this.catalogProductId = catalogProductId;
        this.allergyName = allergyName;
        this.allergenType = allergenType;
        this.reaction = reaction;
        this.severity = severity;
        this.dateIdentified = dateIdentified;
        this.clinicalNotes = clinicalNotes;
        this.createdByUserId = createdByUserId;
        this.updatedByUserId = createdByUserId;
        this.createdAt = now;
        this.updatedAt = now;
    }

    public void update(String allergyCode, UUID catalogProductId, String allergyName, AllergenType allergenType, String reaction,
                       AllergySeverity severity, LocalDate dateIdentified, String clinicalNotes,
                       UUID updatedByUserId, Instant now) {
        this.allergyCode = allergyCode;
        this.catalogProductId = catalogProductId;
        this.allergyName = allergyName;
        this.allergenType = allergenType;
        this.reaction = reaction;
        this.severity = severity;
        this.dateIdentified = dateIdentified;
        this.clinicalNotes = clinicalNotes;
        this.updatedByUserId = updatedByUserId;
        this.updatedAt = now;
    }

    // A removal in the clinical sense — the row stays so the history is auditable, but it stops being
    // shown as a current allergy and stops blocking prescriptions.
    public void deactivate(String reason, UUID userId, Instant now) {
        this.status = AllergyRecordStatus.INACTIVE;
        this.inactiveReason = reason;
        this.inactivatedAt = now;
        this.inactivatedByUserId = userId;
        this.updatedByUserId = userId;
        this.updatedAt = now;
    }

    public void reactivate(UUID userId, Instant now) {
        this.status = AllergyRecordStatus.ACTIVE;
        this.inactiveReason = null;
        this.inactivatedAt = null;
        this.inactivatedByUserId = null;
        this.updatedByUserId = userId;
        this.updatedAt = now;
    }

    public boolean isActive() {
        return status == AllergyRecordStatus.ACTIVE;
    }

    public UUID getId() { return id; }
    public UUID getPatientId() { return patientId; }
    public String getAllergyCode() { return allergyCode; }
    public UUID getCatalogProductId() { return catalogProductId; }
    public String getAllergyName() { return allergyName; }
    public AllergenType getAllergenType() { return allergenType; }
    public String getReaction() { return reaction; }
    public AllergySeverity getSeverity() { return severity; }
    public LocalDate getDateIdentified() { return dateIdentified; }
    public String getClinicalNotes() { return clinicalNotes; }
    public AllergyRecordStatus getStatus() { return status; }
    public String getInactiveReason() { return inactiveReason; }
    public Instant getInactivatedAt() { return inactivatedAt; }
    public UUID getInactivatedByUserId() { return inactivatedByUserId; }
    public UUID getCreatedByUserId() { return createdByUserId; }
    public Instant getCreatedAt() { return createdAt; }
    public UUID getUpdatedByUserId() { return updatedByUserId; }
    public Instant getUpdatedAt() { return updatedAt; }
}
