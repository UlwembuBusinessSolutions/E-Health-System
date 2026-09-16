package co.ehealth.platform.pharmacy;

import java.util.UUID;

public record ClinicalSafetyAlert(UUID ruleId, ClinicalRuleType type, ClinicalSeverity severity, String message,
                                  String drugName, String relatedTo) { }
