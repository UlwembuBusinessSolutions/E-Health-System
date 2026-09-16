package co.ehealth.platform.pharmacy;

import org.junit.jupiter.api.Test;
import java.util.List;
import java.util.UUID;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

class ClinicalSafetyServiceTest {
    @Test
    void identifies_a_ranked_drug_interaction_and_patient_contraindication() {
        DrugSafetyRuleRepository rules = mock(DrugSafetyRuleRepository.class);
        PatientClinicalFactRepository facts = mock(PatientClinicalFactRepository.class);
        UUID patientId = UUID.randomUUID();
        when(rules.findAllByOrderBySeverityDesc()).thenReturn(List.of(
                new DrugSafetyRule(ClinicalRuleType.DRUG_INTERACTION, "Warfarin", "Ibuprofen", null,
                        ClinicalSeverity.HIGH, "Bleeding risk"),
                new DrugSafetyRule(ClinicalRuleType.CONTRAINDICATION, "Amoxicillin", null, "Penicillin allergy",
                        ClinicalSeverity.CRITICAL, "Allergic reaction risk")));
        when(facts.findByPatientId(patientId)).thenReturn(List.of(new PatientClinicalFact(patientId,
                PatientClinicalFact.Type.ALLERGY, "penicillin allergy", java.time.Instant.EPOCH)));

        List<ClinicalSafetyAlert> alerts = new ClinicalSafetyService(rules, facts)
                .check(patientId, List.of(" ibuprofen ", "WARFARIN", "amoxicillin"));

        assertThat(alerts).extracting(ClinicalSafetyAlert::severity)
                .containsExactly(ClinicalSeverity.CRITICAL, ClinicalSeverity.HIGH);
        assertThat(alerts).extracting(ClinicalSafetyAlert::type)
                .containsExactly(ClinicalRuleType.CONTRAINDICATION, ClinicalRuleType.DRUG_INTERACTION);
    }
}
