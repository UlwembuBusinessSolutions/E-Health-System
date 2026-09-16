package co.ehealth.platform.pharmacy;

import org.springframework.stereotype.Service;
import java.util.*;

@Service
public class ClinicalSafetyService {
    private final DrugSafetyRuleRepository rules;
    private final PatientClinicalFactRepository facts;
    public ClinicalSafetyService(DrugSafetyRuleRepository rules, PatientClinicalFactRepository facts) {
        this.rules = rules; this.facts = facts;
    }
    public List<ClinicalSafetyAlert> check(UUID patientId, List<String> drugNames) {
        Set<String> drugs = normalized(drugNames);
        Set<String> terms = new HashSet<>();
        for (PatientClinicalFact fact : facts.findByPatientId(patientId)) terms.add(normalize(fact.getTerm()));
        // Sort in Java by the clinical enum rather than relying on database string collation.
        // CRITICAL > HIGH > MODERATE > LOW is an explicit clinical ranking.
        return rules.findAllByOrderBySeverityDesc().stream().filter(rule -> matches(rule, drugs, terms))
                .sorted(Comparator.comparing(DrugSafetyRule::getSeverity).reversed())
                .map(rule -> new ClinicalSafetyAlert(rule.getId(), rule.getRuleType(), rule.getSeverity(), rule.getMessage(),
                        rule.getDrugName(), rule.getRelatedDrugName() != null ? rule.getRelatedDrugName() : rule.getClinicalTerm())).toList();
    }
    private boolean matches(DrugSafetyRule rule, Set<String> drugs, Set<String> terms) {
        if (!drugs.contains(normalize(rule.getDrugName()))) return false;
        return rule.getRuleType() == ClinicalRuleType.DRUG_INTERACTION
                ? drugs.contains(normalize(rule.getRelatedDrugName()))
                : terms.contains(normalize(rule.getClinicalTerm()));
    }
    private Set<String> normalized(List<String> values) { Set<String> result = new HashSet<>(); for (String value : values) result.add(normalize(value)); return result; }
    private String normalize(String value) { return value == null ? "" : value.trim().replaceAll("\\s+", " ").toLowerCase(Locale.ROOT); }
}
