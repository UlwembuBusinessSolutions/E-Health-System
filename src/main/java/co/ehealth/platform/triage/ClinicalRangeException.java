package co.ehealth.platform.triage;

import java.util.Map;

/** Values outside a plausible human range are rejected; borderline values need explicit confirmation. */
public class ClinicalRangeException extends RuntimeException {
    private final Map<String, String> fieldErrors;

    public ClinicalRangeException(String message, Map<String, String> fieldErrors) {
        super(message);
        this.fieldErrors = fieldErrors;
    }

    public Map<String, String> getFieldErrors() { return fieldErrors; }
}
