package co.ehealth.platform.consultation;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.util.UUID;

// A genuine one-to-many with its own per-row identity (text, primary flag,
// certainty) — a real child table, not an @ElementCollection, since each
// row is individually addable/removable and (later) codeable on its own,
// unlike TriageAssessment's discriminators which are just a set of enum
// values with no per-row fields of their own.
//
// codingSystem/catalogueVersion/code/displayText stay nullable and unused
// by this slice — forward-compat room for a real ICD-10/SNOMED catalogue
// once one is configured for a deployment (design doc §13.5), included now
// rather than retrofitted onto historical rows later.
@Entity
@Table(name = "consultation_diagnoses")
public class ConsultationDiagnosis {

    @Id
    @GeneratedValue
    private UUID id;

    @Column(name = "consultation_id", nullable = false)
    private UUID consultationId;

    @Column(name = "diagnosis_text", nullable = false)
    private String diagnosisText;

    @Column(name = "is_primary", nullable = false)
    private boolean primary;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private DiagnosisCertainty certainty;

    @Column(name = "sort_order", nullable = false)
    private int sortOrder;

    @Column(name = "coding_system")
    private String codingSystem;

    @Column(name = "catalogue_version")
    private String catalogueVersion;

    @Column(name = "code")
    private String code;

    @Column(name = "display_text")
    private String displayText;

    protected ConsultationDiagnosis() {
    }

    public ConsultationDiagnosis(UUID consultationId, String diagnosisText, boolean primary,
                                  DiagnosisCertainty certainty, int sortOrder) {
        this.consultationId = consultationId;
        this.diagnosisText = diagnosisText;
        this.primary = primary;
        this.certainty = certainty;
        this.sortOrder = sortOrder;
    }

    // ConsultationService.addDiagnosis()'s "marking this one primary
    // auto-clears any other primary on the same consultation" rule calls
    // this on the rows being demoted, not just the one being promoted.
    public void setPrimary(boolean primary) {
        this.primary = primary;
    }

    public UUID getId() {
        return id;
    }

    public UUID getConsultationId() {
        return consultationId;
    }

    public String getDiagnosisText() {
        return diagnosisText;
    }

    public boolean isPrimary() {
        return primary;
    }

    public DiagnosisCertainty getCertainty() {
        return certainty;
    }

    public int getSortOrder() {
        return sortOrder;
    }

    public String getCodingSystem() {
        return codingSystem;
    }

    public String getCatalogueVersion() {
        return catalogueVersion;
    }

    public String getCode() {
        return code;
    }

    public String getDisplayText() {
        return displayText;
    }
}
