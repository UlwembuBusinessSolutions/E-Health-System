package co.ehealth.platform.pharmacy;

import jakarta.persistence.*;
import java.util.UUID;

@Entity
@Table(name = "drug_safety_rules")
public class DrugSafetyRule {
    @Id @GeneratedValue private UUID id;
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 30) private ClinicalRuleType ruleType;
    @Column(name = "drug_name", nullable = false, length = 200) private String drugName;
    @Column(name = "related_drug_name", length = 200) private String relatedDrugName;
    @Column(name = "clinical_term", length = 200) private String clinicalTerm;
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 10) private ClinicalSeverity severity;
    @Column(nullable = false, length = 1000) private String message;
    protected DrugSafetyRule() { }
    public DrugSafetyRule(ClinicalRuleType ruleType, String drugName, String relatedDrugName, String clinicalTerm,
                          ClinicalSeverity severity, String message) {
        this.ruleType = ruleType; this.drugName = drugName; this.relatedDrugName = relatedDrugName;
        this.clinicalTerm = clinicalTerm; this.severity = severity; this.message = message;
    }
    public UUID getId() { return id; }
    public ClinicalRuleType getRuleType() { return ruleType; }
    public String getDrugName() { return drugName; }
    public String getRelatedDrugName() { return relatedDrugName; }
    public String getClinicalTerm() { return clinicalTerm; }
    public ClinicalSeverity getSeverity() { return severity; }
    public String getMessage() { return message; }
}
