package co.ehealth.platform.patient;

import co.ehealth.platform.consultation.AllergyStatus;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

// The patient's overall allergy status — "unknown" (never asked) versus "no known allergies" (asked,
// none reported) versus "known" (one or more active allergies). Reuses the consultation module's
// AllergyStatus so the two records speak the same three-state language.
@Entity
@Table(name = "patient_allergy_profiles")
public class PatientAllergyProfile {

    @Id
    @Column(name = "patient_id")
    private UUID patientId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private AllergyStatus status = AllergyStatus.UNKNOWN;

    @Column(name = "updated_by_user_id")
    private UUID updatedByUserId;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected PatientAllergyProfile() {
    }

    public PatientAllergyProfile(UUID patientId, AllergyStatus status, UUID updatedByUserId, Instant now) {
        this.patientId = patientId;
        this.status = status;
        this.updatedByUserId = updatedByUserId;
        this.updatedAt = now;
    }

    public void changeStatus(AllergyStatus status, UUID userId, Instant now) {
        this.status = status;
        this.updatedByUserId = userId;
        this.updatedAt = now;
    }

    public UUID getPatientId() { return patientId; }
    public AllergyStatus getStatus() { return status; }
    public UUID getUpdatedByUserId() { return updatedByUserId; }
    public Instant getUpdatedAt() { return updatedAt; }
}