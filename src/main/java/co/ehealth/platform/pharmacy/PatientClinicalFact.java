package co.ehealth.platform.pharmacy;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "patient_clinical_facts", uniqueConstraints = @UniqueConstraint(columnNames = {"patient_id", "fact_type", "term"}))
public class PatientClinicalFact {
    @Id @GeneratedValue private UUID id;
    @Column(name = "patient_id", nullable = false) private UUID patientId;
    @Enumerated(EnumType.STRING) @Column(name = "fact_type", nullable = false, length = 20) private Type type;
    @Column(nullable = false, length = 200) private String term;
    @Column(name = "recorded_at", nullable = false) private Instant recordedAt;
    protected PatientClinicalFact() { }
    public PatientClinicalFact(UUID patientId, Type type, String term, Instant recordedAt) {
        this.patientId = patientId; this.type = type; this.term = term; this.recordedAt = recordedAt;
    }
    public UUID getId() { return id; }
    public UUID getPatientId() { return patientId; }
    public Type getType() { return type; }
    public String getTerm() { return term; }
    public Instant getRecordedAt() { return recordedAt; }
    public enum Type { ALLERGY, CONDITION }
}
