package co.ehealth.platform.pharmacy;

import java.util.List;

public class ClinicalSafetyBlockedException extends RuntimeException {
    private final List<ClinicalSafetyAlert> alerts;
    public ClinicalSafetyBlockedException(List<ClinicalSafetyAlert> alerts) {
        super("A high-severity clinical alert requires an explicit override reason."); this.alerts = List.copyOf(alerts);
    }
    public List<ClinicalSafetyAlert> getAlerts() { return alerts; }
}
