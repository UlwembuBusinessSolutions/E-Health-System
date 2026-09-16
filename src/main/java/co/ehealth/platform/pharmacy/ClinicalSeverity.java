package co.ehealth.platform.pharmacy;

public enum ClinicalSeverity {
    LOW, MODERATE, HIGH, CRITICAL;

    public boolean requiresOverride() {
        return this == HIGH || this == CRITICAL;
    }
}
